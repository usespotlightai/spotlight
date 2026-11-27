export function OutputLegend({ priced }: { priced: boolean }) {
  return (
    <figcaption
      data-slot="output-legend"
      className="flex items-center justify-between gap-3 text-muted-foreground text-xs"
    >
      <span className="flex items-center gap-1">
        <span aria-hidden className="size-2 rounded-sm bg-chart-bar-quiet" />
        PRs merged, left axis
      </span>
      {priced && (
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-0.5 w-3 bg-chart-line" />
          Spent a day, right axis
        </span>
      )}
    </figcaption>
  );
}
