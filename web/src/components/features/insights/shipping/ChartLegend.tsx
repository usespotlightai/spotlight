type LegendEntry = {
  readonly label: string;
  readonly color: string;
};

export function ChartLegend({ entries }: { entries: readonly LegendEntry[] }) {
  return (
    <figcaption className="flex flex-wrap items-center gap-3 text-muted-foreground text-[0.7rem]">
      {entries.map((entry) => (
        <span key={entry.label} className="flex items-center gap-1">
          <span
            aria-hidden
            className="size-2 rounded-sm"
            style={{ background: entry.color }}
          />
          {entry.label}
        </span>
      ))}
    </figcaption>
  );
}
