import { MarkdownEditor } from '@/components/shared/form/MarkdownEditor';
import { nonEmpty } from '@/lib/non-empty';

export type SetupAboutProps = {
  readonly title: string;
  readonly description: string | null;
};

export function SetupAbout({ title, description }: SetupAboutProps) {
  return (
    <div>
      <h1 className="font-medium text-foreground text-sm leading-6">{title}</h1>

      {nonEmpty(description) && (
        <MarkdownEditor
          readOnly
          initialValue={description}
          placeholder=""
          ariaLabel="Description"
          className="border-none bg-transparent p-0"
        />
      )}
    </div>
  );
}
