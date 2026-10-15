import { useState } from 'react';
import { GradeOptionButton } from '@/components/features/inbox/grades/GradeOptionButton';
import { claimShown, type Grade, gradeOptions, YOUR_GRADE } from '@/lib/judge';

type ClaimsGradeProps = {
  claims: readonly (string | null)[];
  mine: Grade | null;
  pending: boolean;
  onGrade: (claims: readonly boolean[]) => void;
};

const answered = (
  answers: readonly (boolean | null)[],
): answers is readonly boolean[] => answers.every((each) => each !== null);

export function ClaimsGrade({
  claims,
  mine,
  pending,
  onGrade,
}: ClaimsGradeProps) {
  const [answers, setAnswers] = useState<readonly (boolean | null)[]>(() =>
    claims.map((_, at) => mine?.marks?.[at] ?? null),
  );

  const answer = (at: number, met: boolean) => {
    if (answers[at] === met) {
      return;
    }

    const next = answers.map((each, place) => (place === at ? met : each));
    setAnswers(next);

    if (answered(next)) {
      onGrade(next);
    }
  };

  return (
    <ol
      data-slot="claims-grade"
      aria-label={YOUR_GRADE}
      className="flex flex-col gap-3"
    >
      {claims.map((_, at) => (
        <li
          // biome-ignore lint/suspicious/noArrayIndexKey: the position of a claim in the judge's list identifies it
          key={at}
          data-slot="claim-to-grade"
        >
          <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
            <legend className="float-left w-full break-words p-0 text-foreground text-sm leading-6">
              <span aria-hidden className="text-muted-foreground tabular-nums">
                {at + 1}.{' '}
              </span>
              {claimShown(claims, at)}
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              {gradeOptions('yes-no').map((option) => (
                <GradeOptionButton
                  key={option.label}
                  label={option.label}
                  chosen={answers[at] === option.value}
                  pending={pending}
                  onClick={() => answer(at, option.value === true)}
                />
              ))}
            </div>
          </fieldset>
        </li>
      ))}
    </ol>
  );
}
