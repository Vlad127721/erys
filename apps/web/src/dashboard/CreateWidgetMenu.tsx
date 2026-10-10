import { WIDGET_TYPES, type WidgetType } from '@youscan/shared';
import { useRef } from 'react';
import { Button, InlineError } from '../components/ui';
import { WIDGET_LABELS } from '../widgets/labels';
import { useCreateWidget } from '../widgets/queries';

/**
 * Uses the native popover API (closing on an outside click comes for free), positioned under
 * the button with CSS anchor positioning.
 */
export function CreateWidgetMenu() {
  const create = useCreateWidget();
  const popover = useRef<HTMLDivElement>(null);

  const choose = (type: WidgetType) => {
    popover.current?.hidePopover();
    create.mutate(type);
  };

  return (
    <div className="flex flex-col items-end gap-1.5 [anchor-name:--create-widget]">
      <Button variant="primary" popoverTarget="create-widget-menu" disabled={create.isPending}>
        {create.isPending ? 'Creating…' : '+ Create widget'}
      </Button>
      <div
        id="create-widget-menu"
        ref={popover}
        popover="auto"
        role="menu"
        className="inset-auto top-[anchor(bottom)] right-[anchor(right)] mx-0 mt-1.5 mb-0 min-w-[200px] flex-col rounded-[10px] border border-line bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)] [position-anchor:--create-widget] open:flex"
      >
        {WIDGET_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            role="menuitem"
            className="cursor-pointer rounded-md px-3 py-2 text-left text-ink hover:bg-page"
            onClick={() => choose(type)}
          >
            {WIDGET_LABELS[type]}
          </button>
        ))}
      </div>
      {create.isError && <InlineError>Could not create widget: {create.error.message}</InlineError>}
    </div>
  );
}
