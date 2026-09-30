import { coverageParts, type JudgeCoverage } from '@/lib/judge';

export function JudgeCoverageFigures({
  coverage,
}: {
  coverage: JudgeCoverage;
}) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <p className="text-muted-foreground">
        Of the station’s last {coverage.runs}{' '}
        {coverage.runs === 1 ? 'run' : 'runs'}
      </p>
      <dl
        data-slot="judge-coverage"
        className="flex flex-wrap gap-x-3 gap-y-0.5"
      >
        {coverageParts(coverage).map((part) => (
          <div key={part.label} className="flex items-center gap-1">
            <dt className="text-muted-foreground">{part.label}</dt>
            <dd className="text-foreground tabular-nums">{part.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
