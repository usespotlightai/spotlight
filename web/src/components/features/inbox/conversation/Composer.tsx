import { ArrowUp, Square } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { AttachButton } from '@/components/shared/attachment/AttachButton';
import { PendingAttachments } from '@/components/shared/attachment/PendingAttachments';
import { AutoGrowTextarea } from '@/components/shared/form/AutoGrowTextarea';
import { Button } from '@/components/ui/button';
import { useAttachments } from '@/hooks/useAttachments';
import { cn } from '@/lib/utils';

type ComposerProps = {
  slug: string;
  label: string;
  placeholder: string;
  pending: boolean;
  onSend: (body: string, attachments: string[], sent: () => void) => void;
  running?: boolean;
  onStop?: () => void;
};

export function Composer({
  slug,
  label,
  placeholder,
  pending,
  onSend,
  running = false,
  onStop,
}: ComposerProps) {
  const [body, setBody] = useState('');
  const draft = useAttachments(slug);

  const said = body.trim();
  const attaching = draft.attachments.length > 0;

  const showStop = running && Boolean(onStop) && said === '' && !attaching;

  const unsendable =
    (!said && draft.ids.length === 0) || draft.uploading || pending;

  const send = (event?: FormEvent) => {
    event?.preventDefault();

    if (unsendable) {
      return;
    }

    onSend(said, draft.ids, () => {
      setBody('');
      draft.clear();
    });
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
      {...draft.handlers}
      className={cn(
        'flex flex-col gap-2 border border-border bg-surface p-1 shadow-xs',
        attaching ? 'rounded-2xl pt-2 pl-2' : 'rounded-full',
      )}
    >
      <PendingAttachments
        attachments={draft.attachments}
        onRemove={draft.remove}
      />

      <div className="flex items-center gap-2">
        <AttachButton
          onAttach={draft.add}
          disabled={pending}
          className="rounded-full text-muted-foreground"
        />

        <AutoGrowTextarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={pending}
          aria-label={label}
          placeholder={placeholder}
          className="max-h-56 flex-1 overflow-y-auto text-sm leading-6"
        />

        {showStop ? (
          <Button
            type="button"
            size="icon-sm"
            className="rounded-full"
            onClick={onStop}
            aria-label="Stop"
          >
            <Square className="size-3 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon-sm"
            className="rounded-full"
            disabled={unsendable}
            aria-label="Send"
          >
            <ArrowUp />
          </Button>
        )}
      </div>
    </form>
  );
}
