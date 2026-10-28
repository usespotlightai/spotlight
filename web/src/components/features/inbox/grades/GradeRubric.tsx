import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RUBRIC_LABEL, RUBRIC_TEXT_LABEL } from '@/lib/judge';

type GradeRubricProps = {
  rubric: string;
};

export function GradeRubric({ rubric }: GradeRubricProps) {
  return (
    <ScrollArea
      className="max-h-48 rounded"
      viewportClassName="overscroll-contain"
    >
      <section
        data-slot="grade-rubric"
        aria-label={RUBRIC_LABEL}
        className="break-words"
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
    </ScrollArea>
  );
}
