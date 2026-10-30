import type { ComponentProps } from 'react';
import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { RUBRIC_LABEL, RUBRIC_TEXT_LABEL } from '@/lib/judge';

type GradeRubricProps = {
  rubric: string;
  size?: ComponentProps<typeof MarkdownEditor>['size'];
};

export function GradeRubric({ rubric, size }: GradeRubricProps) {
  return (
    <section
      data-slot="grade-rubric"
      aria-label={RUBRIC_LABEL}
      className="break-words"
    >
      <MarkdownEditor
        key={rubric}
        readOnly
        size={size}
        initialValue={rubric}
        placeholder=""
        ariaLabel={RUBRIC_TEXT_LABEL}
        className="border-none bg-transparent p-0"
      />
    </section>
  );
}
