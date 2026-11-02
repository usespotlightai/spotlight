import { CitedPlaces } from '@/components/features/changes/CitedPlaces';
import { QuestionVerdict } from '@/components/features/changes/QuestionVerdict';
import { ReviewerAvatar } from '@/components/features/review/ReviewerAvatar';
import { ThreadEntry } from '@/components/features/review/ThreadEntry';
import { Composer } from '@/components/shared/form/Composer';
import { Logo } from '@/components/shared/icons';
import { Pill } from '@/components/shared/Pill';
import { Button } from '@/components/ui/button';
import { useAnswerStackQuestion } from '@/hooks/api/useAnswerStackQuestion';
import { useMe } from '@/hooks/useMe';
import {
  type ChangeStack,
  type CitedPlace,
  citedBy,
  type LayerQuestion,
} from '@/lib/change-stack';
import { YOU } from '@/lib/person';
import { useReviewing } from '@/lib/review-context';

type LayerQuestionThreadProps = {
  stack: ChangeStack;
  question: LayerQuestion;
  onReveal: (place: CitedPlace) => void;
};

const MAX_REPLY = 4_000;

export function LayerQuestionThread({
  stack,
  question,
  onReveal,
}: LayerQuestionThreadProps) {
  const reviewing = useReviewing();
  const me = useMe();
  const answering = useAnswerStackQuestion();
  const { answered } = question;

  const answer = (reply: string | null) => {
    if (reviewing) {
      answering.mutate({
        teamId: reviewing.teamId,
        runId: reviewing.runId,
        stackId: stack.id,
        questionId: question.id,
        reply,
      });
    }
  };

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
            {answered.reply ? (
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

        {answered && (
          <ThreadEntry
            first={false}
            avatar={<Logo className="size-5 rounded" aria-hidden />}
            author="Spotlight"
            meta={<QuestionVerdict verdict={answered.verdict} />}
          >
            {answered.feedback && (
              <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-5">
                {answered.feedback}
              </p>
            )}
            <p className="whitespace-pre-wrap break-words text-muted-foreground text-sm leading-5">
              Expected answer: {answered.expected}
            </p>
            <CitedPlaces
              places={citedBy(stack, question)}
              onReveal={onReveal}
            />
          </ThreadEntry>
        )}
      </ol>

      {!answered && (
        <Composer
          label={`Answer “${question.question}”`}
          placeholder="Your answer…"
          submitLabel="Check"
          max={MAX_REPLY}
          avatar={<ReviewerAvatar />}
          autoFocus={false}
          pending={answering.isPending}
          onSubmit={answer}
          aside={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={answering.isPending}
              onClick={() => answer(null)}
            >
              I don’t know
            </Button>
          }
        />
      )}

      {answering.isError && !answered && (
        <p role="alert" className="text-destructive text-xs leading-5">
          Sorry, the answer couldn’t be checked. Please try again.
        </p>
      )}
    </section>
  );
}
