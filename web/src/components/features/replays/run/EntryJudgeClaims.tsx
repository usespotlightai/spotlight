import { ClaimVerdicts } from '@/components/features/runs/judge/ClaimVerdicts';
import { formatPassThreshold } from '@/lib/judge';
import type { ReplayEntry } from '@/lib/replay';

type EntryJudgeClaimsProps = {
  judge: NonNullable<ReplayEntry['judge']>;
  marks: readonly boolean[];
};

export function EntryJudgeClaims({ judge, marks }: EntryJudgeClaimsProps) {
  return (
    <div data-slot="entry-judge-claims" className="flex flex-col gap-1.5">
      <ClaimVerdicts
        claims={judge.claims}
        marks={marks}
        reasons={judge.reasons}
      />
      {judge.passThreshold !== null && (
        <p className="text-muted-foreground">
          {formatPassThreshold(judge.passThreshold)}
        </p>
      )}
    </div>
  );
}
