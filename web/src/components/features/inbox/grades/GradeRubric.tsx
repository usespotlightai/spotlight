import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { RUBRIC_LABEL, RUBRIC_TEXT_LABEL } from '@/lib/judge';

type GradeRubricProps = {
  rubric: string;
};

export function GradeRubric({ rubric }: GradeRubricProps) {
  return (
    <section
      data-slot="grade-rubric"
      aria-label={RUBRIC_LABEL}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: a scrolling region takes focus so the keyboard can scroll it
      tabIndex={0}
      className="max-h-48 overflow-y-auto overscroll-contain break-words rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <MarkdownEditor
        key={rubric}
        readOnly
        initialValue={rubric}
        placeholder=""
        ariaLabel={RUBRIC_TEXT_LABEL}
        className="border-none bg-transparent p-0"
      />
    </section>
  );
}
