import { ArrowUp } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { AutoGrowTextarea } from '@/components/common/form/AutoGrowTextarea';
import { Button } from '@/components/ui/button';

type ComposerProps = {
  label: string;
  placeholder: string;
  pending: boolean;
  onSend: (body: string, sent: () => void) => void;
};

export function Composer({
  label,
  placeholder,
  pending,
  onSend,
}: ComposerProps) {
  const [body, setBody] = useState('');

  const said = body.trim();

  const send = (event?: FormEvent) => {
    event?.preventDefault();

    if (!said || pending) {
      return;
    }

    onSend(said, () => setBody(''));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <form
      onSubmit={send}
      className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pr-1 pl-4 shadow-xs"
    >
      <AutoGrowTextarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={pending}
        aria-label={label}
        placeholder={placeholder}
        className="max-h-56 flex-1 overflow-y-auto text-sm leading-6"
      />

      <Button
        type="submit"
        size="icon-sm"
        className="rounded-full"
        disabled={!said || pending}
        aria-label="Send"
      >
        <ArrowUp />
      </Button>
    </form>
  );
}
