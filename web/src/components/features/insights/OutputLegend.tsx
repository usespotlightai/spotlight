export function OutputLegend({ priced }: { priced: boolean }) {
  return (
    <figcaption className="flex items-center gap-3 text-muted-foreground text-xs">
      {priced && (
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-0.5 w-3 bg-chart-line" />
          Spend, right axis
        </span>
      )}
      <span className="flex items-center gap-1">
        <span aria-hidden className="size-2 rounded-sm bg-chart-bar-quiet" />
        PRs merged, left axis
      </span>
    </figcaption>
  );
}
