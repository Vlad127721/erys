import { ErrorState } from '../components/StatusViews';
import { ThemeToggle } from '../components/ThemeToggle';
import { useWidgetList } from '../widgets/queries';
import { CARD, WidgetCard } from '../widgets/WidgetCard';
import { CreateWidgetMenu } from './CreateWidgetMenu';

/** Three widgets per row on wide screens, as many rows as needed; narrower screens collapse. */
const GRID = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';

export function Dashboard() {
  const widgets = useWidgetList();

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-6 pb-12">
      <header className="mb-5 flex items-start justify-between gap-4">
        <h1 className="m-0 text-[22px] font-semibold">Dashboard</h1>
        <div className="flex items-start gap-3">
          <ThemeToggle />
          <CreateWidgetMenu />
        </div>
      </header>

      <main>
        {widgets.isPending ? (
          <div className={GRID} aria-busy="true" aria-label="Loading dashboard">
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${CARD} animate-pulse`} />
            ))}
          </div>
        ) : widgets.isError ? (
          // Without the list there is no grid at all, so this is a page-level error.
          <ErrorState
            title="Couldn’t load the dashboard"
            message={widgets.error.message}
            onRetry={() => void widgets.refetch()}
            retrying={widgets.isFetching}
          />
        ) : widgets.data.length === 0 ? (
          <p className="px-4 py-12 text-center text-ink-secondary">No widgets yet. Use “Create widget” to add one.</p>
        ) : (
          <div className={GRID}>
            {widgets.data.map((widget) => (
              <WidgetCard key={widget.id} widget={widget} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
