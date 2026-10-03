import { useState } from 'react';
import { GradeNotSaved } from '@/components/features/inbox/grades/GradeNotSaved';
import { Button } from '@/components/ui/button';
import {
  ANSWER_EVERY_CLAIM,
  CLAIMS_QUESTION,
  claimShown,
  claimsGradedShown,
  type Grade,
  gradeOptions,
  REWORDED_CLAIM,
  SAVE_GRADE,
  scoreShown,
  YOUR_GRADE,
} from '@/lib/judge';

type ClaimsGradeProps = {
  claims: readonly (string | null)[];
  mine: Grade | null;
  pending: boolean;
  failed: boolean;
  onGrade: (claims: readonly boolean[]) => void;
};

const answered = (
  answers: readonly (boolean | null)[],
): answers is readonly boolean[] => answers.every((each) => each !== null);

export function ClaimsGrade({
  claims,
  mine,
  pending,
  failed,
  onGrade,
}: ClaimsGradeProps) {
  const [answers, setAnswers] = useState<readonly (boolean | null)[]>(() =>
    claims.map((_, at) => mine?.marks?.[at] ?? null),
  );
  const answer = (at: number, met: boolean) =>
    setAnswers((was) => was.map((each, place) => (place === at ? met : each)));
  const complete = answered(answers);

  return (
    <section
      data-slot="claims-grade"
      aria-label={YOUR_GRADE}
      className="flex flex-col gap-3"
    >
      <h3 className="font-medium text-foreground text-sm">{CLAIMS_QUESTION}</h3>

      <ol className="flex flex-col gap-3">
        {claims.map((claim, at) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: a claim is named by its place in the judge's list
            key={at}
            data-slot="claim-to-grade"
            className="flex flex-col gap-1.5"
          >
            <p className="text-foreground text-sm leading-6">
              <span className="text-muted-foreground tabular-nums">
                {at + 1}.{' '}
              </span>
              {claimShown(claims, at)}
            </p>
            {claim === null && (
              <p className="text-muted-foreground text-xs">{REWORDED_CLAIM}</p>
            )}
            <fieldset
              aria-label={claimShown(claims, at)}
              className="m-0 flex min-w-0 gap-2 border-0 p-0"
            >
              {gradeOptions('yes-no').map((option) => {
                const chosen = answers[at] === option.value;

                return (
                  <Button
                    key={option.label}
                    type="button"
                    size="sm"
                    variant={chosen ? 'default' : 'outline'}
                    aria-pressed={chosen}
                    disabled={pending}
                    className="min-w-12 rounded-full"
                    onClick={() => answer(at, option.value === true)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={pending || !complete}
          onClick={() => complete && onGrade(answers)}
        >
          {SAVE_GRADE}
        </Button>
        {!complete && (
          <p className="text-muted-foreground text-xs">{ANSWER_EVERY_CLAIM}</p>
        )}
      </div>

      {mine && (
        <p className="text-muted-foreground text-xs">
          {claimsGradedShown(scoreShown(mine))}
        </p>
      )}

      {failed && <GradeNotSaved />}
    </section>
  );
}
