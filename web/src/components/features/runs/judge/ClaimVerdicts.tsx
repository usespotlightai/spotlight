import { ClaimMark } from '@/components/features/runs/judge/ClaimMark';
import { JudgeReasons } from '@/components/features/runs/judge/JudgeReasons';
import { CLAIMS_LABEL, formatClaim, type JudgeReason } from '@/lib/judge';

type ClaimVerdictsProps = {
  claims: readonly (string | null)[];
  marks: readonly boolean[];
  reasons: readonly JudgeReason[];
};

export function ClaimVerdicts({ claims, marks, reasons }: ClaimVerdictsProps) {
  return (
    <ol
      data-slot="claim-verdicts"
      aria-label={CLAIMS_LABEL}
      className="flex flex-col gap-2"
    >
      {marks.map((met, at) => {
        const why = reasons.filter((each) => each.claim === at);

        return (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: the position of a claim in the judge's list identifies it
            key={at}
            data-slot="claim-verdict"
            className="flex flex-col gap-1"
          >
            <p className="flex items-baseline gap-2 text-foreground text-sm leading-6">
              <ClaimMark met={met} />
              <span>{formatClaim(claims, at)}</span>
            </p>
            {why.length > 0 && (
              <JudgeReasons
                reasons={why}
                label={`Why, on ${formatClaim(claims, at)}`}
                className="pl-5"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
