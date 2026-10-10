import type {
  CreateWidgetRequest,
  WidgetDataResponse,
  WidgetMeta,
  WidgetPayload,
  WidgetType,
} from '@youscan/shared';
import { HttpError, notFound, unprocessable } from '../http/errors.js';
import type { Logger } from '../http/error-handler.js';
import type { RandomDataService } from './random-data.service.js';
import { CorruptedWidgetDataError, type WidgetsRepository } from './widgets.repository.js';

const DEFAULT_TITLES: Record<WidgetType, string> = {
  LINE: 'Line chart',
  BAR: 'Bar chart',
  STACKED_BAR: 'Stacked bar chart',
  PIE: 'Pie chart',
  TEXT: 'Note',
};

export class WidgetsService {
  constructor(
    private readonly widgets: WidgetsRepository,
    private readonly randomData: RandomDataService,
    private readonly logger: Logger = console,
  ) {}

  list(): Promise<WidgetMeta[]> {
    return this.widgets.list();
  }

  async getData(id: string): Promise<WidgetDataResponse> {
    let payload: WidgetPayload | null;
    try {
      payload = await this.widgets.findPayload(id);
    } catch (error) {
      if (!(error instanceof CorruptedWidgetDataError)) throw error;
      // Only this widget fails; the rest of the dashboard keeps working. Details stay in the log.
      this.logger.error(
        `Widget ${error.widgetId} has stored data that does not match its type: ${JSON.stringify(error.issues)}`,
        error.stack,
      );
      throw new HttpError(500, 'Widget data is corrupted', undefined, { cause: error });
    }

    if (!payload) throw this.notFound(id);
    return { id, ...payload };
  }

  /** Chart widgets get random data, generated once and persisted with the widget. */
  create({ type, title }: CreateWidgetRequest): Promise<WidgetMeta> {
    return this.widgets.create({ title: title ?? DEFAULT_TITLES[type], payload: this.randomData.generate(type) });
  }

  async updateText(id: string, text: string): Promise<WidgetMeta> {
    const updated = await this.widgets.updatePayload(id, { type: 'TEXT', data: { text } });
    if (updated) return updated;
    if (await this.widgets.findMeta(id)) throw unprocessable('Only text widgets can be edited');
    throw this.notFound(id);
  }

  async remove(id: string): Promise<void> {
    if (!(await this.widgets.delete(id))) throw this.notFound(id);
  }

  private notFound(id: string): HttpError {
    return notFound(`Widget ${id} not found`);
  }
}
