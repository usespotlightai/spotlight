import { COVERAGE_PARTS, formatPercent, type JudgeCoverage } from '@/lib/judge';

const INKS: Record<(typeof COVERAGE_PARTS)[number]['key'], string> = {
  both: 'var(--chart-primary)',
  judgeOnly: 'color-mix(in oklab, var(--chart-primary) 40%, transparent)',
  peopleOnly: 'color-mix(in oklab, var(--muted-foreground) 45%, transparent)',
  neither: 'color-mix(in oklab, var(--muted-foreground) 18%, transparent)',
};

export function JudgeCoverageBar({ coverage }: { coverage: JudgeCoverage }) {
  const shown = COVERAGE_PARTS.filter((part) => coverage[part.key] > 0);

  return (
    <figure data-slot="judge-coverage" className="flex flex-col gap-3">
      <div
        aria-hidden
        className="flex h-2 w-full gap-px overflow-hidden rounded-full"
      >
        {shown.map((part) => (
          <span
            key={part.key}
            className="h-full min-w-0.5"
            style={{
              flexGrow: coverage[part.key],
              background: INKS[part.key],
            }}
          />
        ))}
      </div>
      <figcaption>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {COVERAGE_PARTS.map((part) => (
            <div key={part.key} className="flex min-w-0 flex-col gap-0.5">
              <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: INKS[part.key] }}
                />
                {part.label}
              </dt>
              <dd className="flex items-baseline gap-1.5 text-sm tabular-nums">
                <span className="text-foreground">{coverage[part.key]}</span>
                <span className="text-muted-foreground">
                  {formatPercent(coverage.rates[part.key])}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </figcaption>
    </figure>
  );
}
