export function OutputLegend({ priced }: { priced: boolean }) {
  return (
    <figcaption className="flex items-center gap-3 text-muted-foreground text-[0.7rem]">
      {priced && (
        <span className="flex items-center gap-1">
          <span aria-hidden className="h-0.5 w-3 bg-chart-primary" />
          Spend
        </span>
      )}
      <span className="flex items-center gap-1">
        <span aria-hidden className="size-2 rounded-sm bg-chart-2" />
        PRs merged
      </span>
    </figcaption>
  );
}
