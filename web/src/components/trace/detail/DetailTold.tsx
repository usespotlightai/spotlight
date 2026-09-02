import { DetailFields } from '@/components/trace/detail/DetailFields';
import { DetailSection } from '@/components/trace/detail/DetailSection';
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
      ) : (
        <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 font-mono text-foreground/80 text-xs leading-5">
          {told.body}
        </pre>
      )}
    </DetailSection>
  );
}
