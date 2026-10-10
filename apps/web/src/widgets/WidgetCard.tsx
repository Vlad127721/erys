import { useQueryClient } from '@tanstack/react-query';
import type { WidgetMeta } from '@youscan/shared';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ErrorState } from '../components/StatusViews';
import { InlineError, Spinner } from '../components/ui';
import { WIDGET_LABELS } from './labels';
import { useDeleteWidget, widgetKeys } from './queries';
import { WidgetContent } from './WidgetContent';

/** Card shell, shared with the dashboard's loading skeleton. */
export const CARD = 'flex min-h-[340px] flex-col rounded-xl border border-line bg-surface p-4';

export function WidgetCard({ widget }: { widget: WidgetMeta }) {
  const remove = useDeleteWidget(widget.id);
  const client = useQueryClient();

  return (
    <article
      className={`${CARD} animate-rise-in transition-opacity motion-reduce:animate-none aria-busy:opacity-55`}
      aria-busy={remove.isPending}
      aria-labelledby={`title-${widget.id}`}
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-[15px] font-semibold" id={`title-${widget.id}`}>
            {widget.title}
          </h2>
          <span className="text-xs text-ink-muted">{WIDGET_LABELS[widget.type]}</span>
        </div>
        <button
          type="button"
          className="grid size-8 flex-none cursor-pointer place-items-center rounded-lg text-ink-muted enabled:hover:bg-danger-wash enabled:hover:text-danger"
          onClick={() => remove.mutate()}
          disabled={remove.isPending}
          aria-label={`Delete “${widget.title}”`}
          title="Delete widget"
        >
          {remove.isPending ? <Spinner size="sm" /> : <TrashIcon />}
        </button>
      </header>

      {remove.isError && <InlineError>Could not delete: {remove.error.message}</InlineError>}

      <div className="flex min-h-0 flex-1 flex-col">
        <ErrorBoundary
          fallback={(error, reset) => (
            <ErrorState
              title="This widget crashed"
              message={error.message}
              onRetry={() => {
                void client.invalidateQueries({ queryKey: widgetKeys.data(widget.id) });
                reset();
              }}
            />
          )}
        >
          <WidgetContent id={widget.id} />
        </ErrorBoundary>
      </div>
    </article>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
