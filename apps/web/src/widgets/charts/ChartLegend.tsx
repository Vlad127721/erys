interface LegendItem {
  name: string;
  color: string;
}

interface Props {
  items: readonly LegendItem[];
  focus: string | null;
  onToggle: (name: string) => void;
}

/**
 * Clickable legend: each entry toggles the chart's filter. All entries stay visible while
 * filtering, so another one can be picked or the active one clicked again to clear.
 */
export function ChartLegend({ items, focus, onToggle }: Props) {
  const filtering = focus !== null && items.some((item) => item.name === focus);
  return (
    <ul className="m-0 flex list-none flex-wrap justify-center gap-x-1 gap-y-0.5 p-0">
      {items.map(({ name, color }) => (
        <li key={name}>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs text-ink-secondary transition-opacity hover:bg-page aria-pressed:border-hairline aria-pressed:font-semibold aria-pressed:text-ink data-[muted=true]:opacity-45"
            aria-pressed={focus === name}
            data-muted={filtering && focus !== name}
            title={focus === name ? `Show all (clear filter ${name})` : `Show only ${name}`}
            onClick={() => onToggle(name)}
          >
            <span className="size-2.5 rounded-[2px]" style={{ background: color }} aria-hidden="true" />
            {name}
          </button>
        </li>
      ))}
    </ul>
  );
}
