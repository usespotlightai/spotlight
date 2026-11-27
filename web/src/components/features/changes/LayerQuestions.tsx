import { LayerQuestionThread } from '@/components/features/changes/LayerQuestionThread';
import type { ChangeStack, CitedPlace, StackLayer } from '@/lib/change-stack';

type LayerQuestionsProps = {
  stack: ChangeStack;
  layer: StackLayer;
  onReveal: (place: CitedPlace) => void;
};

export function LayerQuestions({
  stack,
  layer,
  onReveal,
}: LayerQuestionsProps) {
  if (layer.questions.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Check your understanding"
      className="flex flex-col gap-3"
    >
      <h3 className="font-medium text-foreground text-sm">
        Check your understanding
      </h3>

      {layer.questions.map((question) => (
        <LayerQuestionThread
          key={question.id}
          stack={stack}
          question={question}
          onReveal={onReveal}
        />
      ))}
    </section>
  );
}
