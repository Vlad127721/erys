import { assertNever, type WidgetDataResponse } from '@youscan/shared';
import { ErrorState, LoadingState } from '../components/StatusViews';
import { PieChartView } from './charts/PieChartView';
import { SeriesChart } from './charts/SeriesChart';
import { useWidgetData } from './queries';
import { TextWidget } from './TextWidget';

/** Loads one widget's data and renders it; loading and errors stay inside this widget. */
export function WidgetContent({ id }: { id: string }) {
  const query = useWidgetData(id);

  if (query.isPending) return <LoadingState label="Loading widget data" />;
  if (query.isError) {
    return (
      <ErrorState
        title="Couldn’t load this widget"
        message={query.error.message}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    );
  }

  // Mounted only once data has arrived, so the fade-up plays on load, not on background refetches.
  return (
    <div className="flex min-h-0 flex-1 animate-content-in flex-col motion-reduce:animate-none">
      {renderContent(id, query.data)}
    </div>
  );
}

function renderContent(id: string, widget: WidgetDataResponse) {
  switch (widget.type) {
    case 'LINE':
      return <SeriesChart data={widget.data} variant="line" />;
    case 'BAR':
      return <SeriesChart data={widget.data} variant="bar" />;
    case 'STACKED_BAR':
      return <SeriesChart data={widget.data} variant="stacked" />;
    case 'PIE':
      return <PieChartView data={widget.data} />;
    case 'TEXT':
      return <TextWidget id={id} text={widget.data.text} />;
    default:
      return assertNever(widget);
  }
}
