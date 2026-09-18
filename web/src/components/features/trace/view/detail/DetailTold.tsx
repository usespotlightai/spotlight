import { DetailFields } from '@/components/features/trace/view/detail/DetailFields';
import { DetailSection } from '@/components/features/trace/view/detail/DetailSection';
import { CodeBlock } from '@/components/shared/CodeBlock';
import { shaped, type Told } from '@/lib/detail';

export function DetailTold({ told }: { told: Told }) {
  const fields = told.prose ? null : shaped(told.body);

  return (
    <DetailSection title={told.title} copy={told.body}>
      {fields ? (
        <DetailFields fields={fields} />
      ) : told.prose ? (
        <p className="whitespace-pre-wrap break-words text-foreground/80 text-xs leading-5">
          {told.body}
        </p>
      ) : told.command ? (
        <CodeBlock command={told.body} />
      ) : (
        <CodeBlock output={told.body} />
      )}
    </DetailSection>
  );
}
