import { ClaimVerdicts } from '@/components/features/runs/judge/ClaimVerdicts';
import type { FileChange } from '@/lib/changes';
import { passShareShown } from '@/lib/judge';
import type { ReplayEntry } from '@/lib/replay';

type EntryJudgeClaimsProps = {
  judge: NonNullable<ReplayEntry['judge']>;
  marks: readonly boolean[];
  files: readonly FileChange[];
};

export function EntryJudgeClaims({
  judge,
  marks,
  files,
}: EntryJudgeClaimsProps) {
  return (
    <div data-slot="entry-judge-claims" className="flex flex-col gap-1.5">
      <ClaimVerdicts
        claims={judge.claims}
        marks={marks}
        reasons={judge.reasons}
        files={files}
      />
      {judge.passShare !== null && (
        <p className="text-muted-foreground">
          {passShareShown(judge.passShare)}
        </p>
      )}
    </div>
  );
}
