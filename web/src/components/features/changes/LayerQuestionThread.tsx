import { CircleDashed } from 'lucide-react';
import type { ReactElement } from 'react';

import { CitedPlaces } from '@/components/features/changes/CitedPlaces';
import { QuestionAnswerForm } from '@/components/features/changes/QuestionAnswerForm';
import { QuestionVerdict } from '@/components/features/changes/QuestionVerdict';
import { ReviewerAvatar } from '@/components/features/review/ReviewerAvatar';
import { ThreadEntry } from '@/components/features/review/ThreadEntry';
import { Logo } from '@/components/shared/icons';
import { Pill } from '@/components/shared/Pill';
import { SignInPrompt } from '@/components/shared/SignInPrompt';
import { useMe } from '@/hooks/useMe';
import {
  type ChangeStack,
  type CitedPlace,
  citedBy,
  type LayerQuestion,
  type QuestionAnswer,
} from '@/lib/change-stack';
import { nonEmpty } from '@/lib/non-empty';
import { YOU } from '@/lib/person';
import { useStackVisitor } from '@/lib/review-context';

type LayerQuestionThreadProps = {
  stack: ChangeStack;
  question: LayerQuestion;
  onReveal: (place: CitedPlace) => void;
};

function GradeOf({ answer }: { answer: QuestionAnswer }) {
  if (answer.verdict) {
    return <QuestionVerdict verdict={answer.verdict} />;
  }

  return answer.grading === 'pending' ? (
    <Pill
      lead={<CircleDashed aria-hidden className="size-3 animate-spin" />}
      className="py-0 pr-1.5 pl-1"
    >
      Grading
    </Pill>
  ) : (
    <Pill className="px-1.5 py-0">Not graded</Pill>
  );
}

export function LayerQuestionThread({
  stack,
  question,
  onReveal,
}: LayerQuestionThreadProps): ReactElement {
  const visitor = useStackVisitor();
  const me = useMe();
  const { answered } = question;
  const current = answered && !answered.outdated ? answered : null;

  return (
    <section
      aria-label={`Question: ${question.question}`}
      className="flex flex-col gap-3 rounded-lg border-[0.5px] border-border bg-card p-3 font-sans shadow-xs"
    >
      <ol className="flex flex-col">
        <ThreadEntry
          avatar={<Logo className="size-5 rounded" aria-hidden />}
          author="Spotlight"
          meta={<Pill className="px-1.5 py-0">Question</Pill>}
        >
          <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
            {question.question}
          </p>
        </ThreadEntry>

        {answered && (
          <ThreadEntry
            first={false}
            avatar={<ReviewerAvatar />}
            author={(me ?? YOU).name}
          >
            {nonEmpty(answered.reply) ? (
              <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
                {answered.reply}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm leading-5">
                I don’t know.
              </p>
            )}
          </ThreadEntry>
        )}

        {answered?.outdated === true && (
          <ThreadEntry
            first={false}
            avatar={<Logo className="size-5 rounded" aria-hidden />}
            author="Spotlight"
            meta={<Pill className="px-1.5 py-0">Changed</Pill>}
          >
            <p className="text-muted-foreground text-sm leading-5">
              The code changed after you answered. Please answer again.
            </p>
          </ThreadEntry>
        )}

        {current && (
          <ThreadEntry
            first={false}
            avatar={<Logo className="size-5 rounded" aria-hidden />}
            author="Spotlight"
            meta={<GradeOf answer={current} />}
          >
            {current.grading === 'pending' && (
              <p
                role="status"
                className="text-muted-foreground text-sm leading-5"
              >
                Grading your answer…
              </p>
            )}
            {current.grading === 'failed' && (
              <p className="text-muted-foreground text-sm leading-5">
                Spotlight couldn’t grade your answer. Compare it with the
                expected answer.
              </p>
            )}
            {nonEmpty(current.feedback) && (
              <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
                {current.feedback}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-muted-foreground text-sm leading-5">
              Expected answer: {current.expected}
            </p>
            <CitedPlaces
              places={citedBy(stack, question)}
              onReveal={onReveal}
            />
          </ThreadEntry>
        )}
      </ol>

      {visitor ? (
        <SignInPrompt signedIn={visitor.signedIn} to="answer this question" />
      ) : (
        !current && <QuestionAnswerForm stack={stack} question={question} />
      )}
    </section>
  );
}
