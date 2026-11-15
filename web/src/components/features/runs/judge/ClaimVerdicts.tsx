import { ClaimMarkScorers } from '@/components/features/runs/judge/ClaimMarkScorers';
import { ClaimVerdictRow } from '@/components/features/runs/judge/ClaimVerdictRow';
import {
  CLAIMS_LABEL,
  type ClaimGrade,
  JUDGE_LABEL,
  type JudgeReason,
} from '@/lib/judge';

type ClaimVerdictsProps = {
  claims: readonly (string | null)[];
  marks: readonly boolean[];
  grade: ClaimGrade | null;
  reasons: readonly JudgeReason[];
};

export function ClaimVerdicts({
  claims,
  marks,
  grade,
  reasons,
}: ClaimVerdictsProps) {
  const scorers = grade ? [JUDGE_LABEL, grade.grader] : [JUDGE_LABEL];

  return (
    <div data-slot="claim-verdicts" className="flex flex-col gap-0.5">
      {grade && <ClaimMarkScorers scorers={scorers} />}
      <ol aria-label={CLAIMS_LABEL} className="flex flex-col gap-1">
        {marks.map((met, at) => {
          const graded = grade ? (grade.marks[at] ?? null) : undefined;

          return (
            <ClaimVerdictRow
              // oxlint-disable-next-line react/no-array-index-key -- the position of a claim in the judge's list identifies it
              key={at}
              index={at}
              text={claims[at]}
              marks={graded === undefined ? [met] : [met, graded]}
              scorers={scorers}
              reasons={reasons.filter((each) => each.claim === at)}
              defaultOpen={
                graded === undefined || graded === null ? !met : graded !== met
              }
            />
          );
        })}
      </ol>
    </div>
  );
}
