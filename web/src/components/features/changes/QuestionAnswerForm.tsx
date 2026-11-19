import { AnswerFailed } from '@/components/features/changes/AnswerFailed';
import { ReviewerAvatar } from '@/components/features/review/ReviewerAvatar';
import { Composer } from '@/components/shared/form/Composer';
import { Button } from '@/components/ui/button';
import { useAnswerStackQuestion } from '@/hooks/api/useAnswerStackQuestion';
import type { ChangeStack, LayerQuestion } from '@/lib/change-stack';
import { useStackTeam } from '@/lib/review-context';

type QuestionAnswerFormProps = {
  stack: ChangeStack;
  question: LayerQuestion;
};

const MAX_REPLY = 4_000;

export function QuestionAnswerForm({
  stack,
  question,
}: QuestionAnswerFormProps) {
  const teamId = useStackTeam();
  const answering = useAnswerStackQuestion();
  const { answered } = question;

  const answer = (reply: string | null) => {
    if (teamId) {
      answering.mutate({
        teamId,
        stackId: stack.id,
        questionId: question.id,
        reply,
      });
    }
  };

  return (
    <>
      <Composer
        key={answered ? 'again' : 'first'}
        label={`Answer “${question.question}”`}
        placeholder="Your answer…"
        initial={answered?.reply ?? ''}
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

      {answering.isError && <AnswerFailed error={answering.error} />}
    </>
  );
}
