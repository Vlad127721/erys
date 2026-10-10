import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WidgetMeta } from '@youscan/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from './Dashboard';

const meta = (id: string, type: WidgetMeta['type'], title: string): WidgetMeta => ({
  id,
  type,
  title,
  updatedAt: '2026-01-01T00:00:00.000Z',
});

const IDS = {
  text: '11111111-1111-4111-8111-111111111111',
  broken: '22222222-2222-4222-8222-222222222222',
  slow: '33333333-3333-4333-8333-333333333333',
};

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

type Route = (init?: RequestInit) => Promise<Response>;

function mockApi(routes: Record<string, Route>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const key = `${init?.method ?? 'GET'} ${url.slice(url.indexOf('/api'))}`;
    const route = routes[key];
    return route ? route(init) : json(404, { message: `No mock for ${key}` });
  });
}

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Dashboard />
    </QueryClientProvider>,
  );
}

const card = (title: string) => screen.getByRole('article', { name: title });

describe('Dashboard', () => {
  let text: string;

  beforeEach(() => {
    text = 'Hello';
  });
  afterEach(() => vi.restoreAllMocks());

  it('isolates loading and error states per widget', async () => {
    let failBroken = true;
    mockApi({
      'GET /api/widgets': () =>
        json(200, [meta(IDS.text, 'TEXT', 'Note'), meta(IDS.broken, 'PIE', 'Broken'), meta(IDS.slow, 'BAR', 'Slow')]),
      [`GET /api/widgets/${IDS.text}/data`]: () => json(200, { id: IDS.text, type: 'TEXT', data: { text } }),
      [`GET /api/widgets/${IDS.broken}/data`]: () =>
        failBroken
          ? json(500, { message: 'Widget data is corrupted' })
          : json(200, { id: IDS.broken, type: 'PIE', data: { slices: [{ name: 'A', value: 1 }] } }),
      [`GET /api/widgets/${IDS.slow}/data`]: () => new Promise(() => {}),
    });

    renderDashboard();

    expect(await within(await screen.findByRole('article', { name: 'Note' })).findByText('Hello')).toBeInTheDocument();
    expect(await within(card('Broken')).findByText('Widget data is corrupted')).toBeInTheDocument();
    expect(within(card('Slow')).getByRole('status')).toBeInTheDocument();

    failBroken = false;
    await userEvent.click(within(card('Broken')).getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(within(card('Broken')).queryByRole('alert')).not.toBeInTheDocument());
    expect(within(card('Slow')).getByRole('status')).toBeInTheDocument();
  });

  it('shows a page-level error with retry when the widget list fails', async () => {
    let fail = true;
    mockApi({ 'GET /api/widgets': () => (fail ? json(503, { message: 'Down' }) : json(200, [])) });

    renderDashboard();

    expect(await screen.findByText('Couldn’t load the dashboard')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/No widgets yet/)).toBeInTheDocument();
  });

  it('edits text and keeps the draft when saving fails', async () => {
    let failSave = true;
    mockApi({
      'GET /api/widgets': () => json(200, [meta(IDS.text, 'TEXT', 'Note')]),
      [`GET /api/widgets/${IDS.text}/data`]: () => json(200, { id: IDS.text, type: 'TEXT', data: { text } }),
      [`PUT /api/widgets/${IDS.text}/text`]: (init) => {
        if (failSave) return json(500, { message: 'Boom' });
        text = (JSON.parse(String(init?.body)) as { text: string }).text;
        return json(200, meta(IDS.text, 'TEXT', 'Note'));
      },
    });

    renderDashboard();
    const note = await screen.findByRole('article', { name: 'Note' });
    await userEvent.click(await within(note).findByRole('button', { name: 'Edit' }));
    const input = within(note).getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'Updated');
    await userEvent.click(within(note).getByRole('button', { name: 'Save' }));

    expect(await within(note).findByText('Could not save: Boom')).toBeInTheDocument();
    expect(within(note).getByRole('textbox')).toHaveValue('Updated');

    failSave = false;
    await userEvent.click(within(note).getByRole('button', { name: 'Save' }));
    expect(await within(note).findByText('Updated')).toBeInTheDocument();
    expect(within(note).queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('filters only the clicked chart and clears on a second click', async () => {
    const PIE = '44444444-4444-4444-8444-444444444444';
    const STACKED = '55555555-5555-4555-8555-555555555555';
    mockApi({
      'GET /api/widgets': () => json(200, [meta(PIE, 'PIE', 'Share'), meta(STACKED, 'STACKED_BAR', 'Sentiment')]),
      [`GET /api/widgets/${PIE}/data`]: () =>
        json(200, { id: PIE, type: 'PIE', data: { slices: [{ name: 'A', value: 1 }, { name: 'B', value: 2 }] } }),
      [`GET /api/widgets/${STACKED}/data`]: () =>
        json(200, {
          id: STACKED,
          type: 'STACKED_BAR',
          data: {
            xAxis: 'category',
            categories: ['A', 'B'],
            series: [
              { name: 'Positive', values: [5, 6] },
              { name: 'Negative', values: [1, 2] },
            ],
          },
        }),
    });

    renderDashboard();
    const pie = await screen.findByRole('article', { name: 'Share' });
    const stacked = await screen.findByRole('article', { name: 'Sentiment' });
    const legendItem = async (card: HTMLElement, name: string) => within(card).findByRole('button', { name });

    await userEvent.click(await legendItem(pie, 'B'));
    expect(await legendItem(pie, 'B')).toHaveAttribute('aria-pressed', 'true');
    expect(await legendItem(pie, 'A')).toHaveAttribute('data-muted', 'true');
    expect(await legendItem(stacked, 'Positive')).toHaveAttribute('data-muted', 'false');

    // Each chart keeps its own filter.
    await userEvent.click(await legendItem(stacked, 'Positive'));
    expect(await legendItem(stacked, 'Negative')).toHaveAttribute('data-muted', 'true');
    expect(await legendItem(pie, 'B')).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(await legendItem(pie, 'B'));
    expect(await legendItem(pie, 'B')).toHaveAttribute('aria-pressed', 'false');
    expect(await legendItem(pie, 'A')).toHaveAttribute('data-muted', 'false');
    expect(await legendItem(stacked, 'Positive')).toHaveAttribute('aria-pressed', 'true');
  });
});
