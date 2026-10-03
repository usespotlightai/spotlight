import { ClaimAgreements } from '@/components/features/stations/judge/ClaimAgreements';
import { ConfusionMatrix } from '@/components/features/stations/judge/ConfusionMatrix';
import { JudgeTrend } from '@/components/features/stations/judge/JudgeTrend';
import { Pill } from '@/components/shared/Pill';
import {
  POOLED_KAPPA,
  percentShown,
  type RubricVersion,
  statShown,
  versionShown,
} from '@/lib/judge';

type RubricVersionCardProps = {
  version: RubricVersion;
  claims: readonly string[];
};

export function RubricVersionCard({ version, claims }: RubricVersionCardProps) {
  const { agreement } = version;
  const figures =
    version.kind === 'number'
      ? [
          { label: 'Spearman’s ρ', value: statShown(agreement.spearman) },
          { label: 'Mean error', value: statShown(agreement.mae) },
        ]
      : [
          {
            label: version.kind === 'claims' ? POOLED_KAPPA : 'Cohen’s kappa',
            value: statShown(agreement.kappa),
          },
          { label: 'Agreed', value: percentShown(agreement.observed) },
        ];

  return (
    <li
      data-slot="rubric-version"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="font-medium text-foreground">Rubric</span>
        <span className="font-mono text-muted-foreground">
          {versionShown(version.rubricVersion)}
        </span>
        <Pill className="px-1.5 py-0">
          {version.current ? 'Current' : 'Earlier'}
        </Pill>
        <span className="text-muted-foreground">
          {version.judged} judged · {agreement.pairs} with people’s scores
        </span>
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
        {figures.map((figure) => (
          <div key={figure.label} className="flex items-center gap-1">
            <dt className="text-muted-foreground">{figure.label}</dt>
            <dd className="text-foreground tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>

      {agreement.claims.length > 0 && (
        <ClaimAgreements agreements={agreement.claims} claims={claims} />
      )}

      {agreement.pairs > 0 && <ConfusionMatrix confusion={version.confusion} />}

      <JudgeTrend trend={version.trend} kind={version.kind} />
    </li>
  );
}
