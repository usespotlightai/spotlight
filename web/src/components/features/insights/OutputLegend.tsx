export function OutputLegend({ priced }: { priced: boolean }) {
  return (
    <figcaption className="flex items-center gap-3 text-muted-foreground text-xs">
      {priced && (
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-0.5 w-3 bg-chart-primary" />
          Spend, right axis
        </span>
      )}
      <span className="flex items-center gap-1">
        <span aria-hidden className="size-2 rounded-sm bg-chart-primary/25" />
        PRs merged, left axis
      </span>
    </figcaption>
  );
}
