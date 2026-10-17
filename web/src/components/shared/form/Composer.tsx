import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from 'react';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { Button } from '@/components/ui/button';

type ComposerProps = {
  label: string;
  submitLabel: string;
  placeholder: string;
  max?: number;
  initial?: string;
  avatar?: ReactNode;
  pending: boolean;
  onSubmit: (body: string) => void;
  onCancel: () => void;
};

export function Composer({
  label,
  submitLabel,
  placeholder,
  max,
  initial = '',
  avatar,
  pending,
  onSubmit,
  onCancel,
}: ComposerProps) {
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
      className="flex flex-col gap-1 rounded-lg border-[0.5px] border-border bg-card px-2 pt-1.5 pb-1 shadow-xs"
    >
      <div className="flex gap-2">
        {avatar && (
          <div className="flex size-5 shrink-0 items-center justify-center *:size-5!">
            {avatar}
          </div>
        )}
        <AutoGrowTextarea
          aria-label={label}
          placeholder={placeholder}
          maxLength={max}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          className="max-h-72 min-h-16 p-0 font-sans text-xs leading-5"
          autoFocus
        />
      </div>

      <div className="flex items-center justify-end gap-2">
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
