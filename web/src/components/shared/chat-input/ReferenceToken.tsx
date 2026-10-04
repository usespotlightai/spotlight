import { ReferenceIcon } from '@/components/shared/chat-input/ReferenceIcon';
import { type Reference, useReferenceState } from '@/lib/chat-input';
import { cn } from '@/lib/utils';

export function ReferenceToken({ reference }: { reference: Reference }) {
  const state = useReferenceState(reference.key);
  const uploading = reference.kind === 'file' && state?.state === 'uploading';
  const failed = reference.kind === 'file' && state?.state === 'failed';

  return (
    <span
      data-slot="chat-reference"
      data-kind={reference.kind}
      title={state?.state === 'failed' ? state.problem : undefined}
      className={cn(
        'mx-0.5 inline-flex items-baseline gap-1 align-baseline',
        uploading && 'animate-pulse opacity-60',
      )}
    >
      <ReferenceIcon reference={reference} />
      <span
        className={cn(
          failed ? 'text-destructive line-through' : 'text-primary',
        )}
      >
        {reference.name}
      </span>
      {uploading && <span className="sr-only">(uploading)</span>}
      {state?.state === 'failed' && (
        <span className="sr-only">(upload failed: {state.problem})</span>
      )}
    </span>
  );
}
