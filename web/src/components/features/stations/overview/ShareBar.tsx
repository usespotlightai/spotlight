const placed = (count: number, runs: number): string =>
  `${runs > 0 ? Math.min(count / runs, 1) * 100 : 0}%`;

export function ShareBar({ count, runs }: { count: number; runs: number }) {
  return (
    <span aria-hidden className="relative block h-1.5 rounded-full bg-muted">
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-chart-primary"
        style={{ width: placed(count, runs) }}
      />
    </span>
  );
}
