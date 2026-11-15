import { useId } from 'react';

import { NumberedClaim } from '@/components/features/runs/judge/NumberedClaim';
import { RadioRow } from '@/components/shared/form/RadioRow';
import { CLAIM_ANSWERS, CLAIMS_QUESTION } from '@/lib/judge';

type ClaimsGradeProps = {
  claims: readonly (string | null)[];
  answers: readonly (boolean | null)[];
  pending: boolean;
  onChange: (at: number, met: boolean) => void;
};

export function ClaimsGrade({
  claims,
  answers,
  pending,
  onChange,
}: ClaimsGradeProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <p
        id={`${id}-question`}
        className="text-muted-foreground text-sm leading-6"
      >
        {CLAIMS_QUESTION}
      </p>
      <ol
        data-slot="claims-grade"
        aria-labelledby={`${id}-question`}
        className="flex flex-col gap-2"
      >
        {claims.map((_, at) => (
          <li
            // oxlint-disable-next-line react/no-array-index-key -- the position of a claim in the judge's list identifies it
            key={at}
            data-slot="claim-to-grade"
            className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1"
          >
            <NumberedClaim
              index={at}
              id={`${id}-${at}`}
              className="flex-1 text-foreground text-sm leading-6"
            >
              {claims[at]}
            </NumberedClaim>
            <div
              role="radiogroup"
              aria-labelledby={`${id}-${at}`}
              className="flex shrink-0 gap-1"
            >
              {CLAIM_ANSWERS.map((option) => (
                <RadioRow
                  compact
                  key={option.label}
                  name={`${id}-claim-${at}`}
                  value={option.met ? 'yes' : 'no'}
                  checked={answers[at] === option.met}
                  disabled={pending}
                  onChange={() => onChange(at, option.met)}
                >
                  {option.label}
                </RadioRow>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
