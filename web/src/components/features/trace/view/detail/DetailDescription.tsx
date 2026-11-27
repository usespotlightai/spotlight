import { DetailFields } from '@/components/features/trace/view/detail/DetailFields';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { type Description, shaped } from '@/lib/detail';

export function DetailDescription({
  description,
}: {
  description: Description;
}) {
  const fields = description.prose ? null : shaped(description.body);

  return (
    <DetailSection title={description.title} copy={description.body}>
      {fields ? (
        <DetailFields fields={fields} />
      ) : description.prose ? (
        <p className="whitespace-pre-wrap break-words text-foreground/80 text-xs leading-5">
          {description.body}
        </p>
      ) : description.command ? (
        <CodeBlock command={description.body} />
      ) : (
        <CodeBlock output={description.body} />
      )}
    </DetailSection>
  );
}
