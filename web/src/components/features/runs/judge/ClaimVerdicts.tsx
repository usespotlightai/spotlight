import { ClaimVerdictRow } from '@/components/features/runs/judge/ClaimVerdictRow';
import { CLAIMS_LABEL, type JudgeReason } from '@/lib/judge';

type ClaimVerdictsProps = {
  claims: readonly string[];
  marks: readonly boolean[];
  reasons: readonly JudgeReason[];
};

export function ClaimVerdicts({ claims, marks, reasons }: ClaimVerdictsProps) {
  return (
    <ol
      data-slot="claim-verdicts"
      aria-label={CLAIMS_LABEL}
      className="flex flex-col gap-1"
    >
      {marks.map((met, at) => (
        <ClaimVerdictRow
          // oxlint-disable-next-line react/no-array-index-key -- the position of a claim in the judge's list identifies it
          key={at}
          index={at}
          text={claims[at]}
          met={met}
          reasons={reasons.filter((each) => each.claim === at)}
          defaultOpen={!met}
        />
      ))}
    </ol>
  );
}
