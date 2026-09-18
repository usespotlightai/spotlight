import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from 'react';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { Button } from '@/components/ui/button';

type ReviewComposerProps = {
  label: string;
  submitLabel: string;
  initial?: string;
  avatar?: ReactNode;
  pending: boolean;
  failed?: boolean;
  onSubmit: (body: string) => void;
  onCancel: () => void;
};

export function ReviewComposer({
  label,
  submitLabel,
  initial = '',
  avatar,
  pending,
  failed = false,
  onSubmit,
  onCancel,
}: ReviewComposerProps) {
  const [body, setBody] = useState(initial);
  const ready = body.trim().length > 0 && !pending;

  const submit = (event?: FormEvent) => {
    event?.preventDefault();

    if (ready) {
      onSubmit(body);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      submit();
    }
    if (event.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-1.5 rounded-lg border-[0.5px] border-border bg-card px-2.5 pt-2 pb-1.5 shadow-xs transition-shadow focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/20"
    >
      <div className="flex gap-2.5">
        {avatar && (
          <div className="flex h-5 shrink-0 items-center">{avatar}</div>
        )}
        <AutoGrowTextarea
          aria-label={label}
          placeholder="Leave a comment"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-72 min-h-20 p-0 font-sans text-sm leading-5"
          autoFocus
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        {failed && (
          <p role="alert" className="mr-auto text-destructive text-xs">
            It could not be saved. Try again.
          </p>
        )}
        <Button type="button" variant="ghost" size="xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="xs" disabled={!ready}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
