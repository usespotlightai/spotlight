import { ArrowUp, Square } from 'lucide-react';
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useState,
} from 'react';
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
  context?: ReactNode;
};

export function Composer({
  slug,
  label,
  placeholder,
  pending,
  onSend,
  running = false,
  onStop,
  context,
}: ComposerProps) {
  const [body, setBody] = useState('');
  const draft = useAttachments(slug);

  const said = body.trim();
  const attaching = draft.attachments.length > 0;

  const showStop = running && Boolean(onStop) && said === '' && !attaching;

  const unsendable =
    (!said && draft.ids.length === 0) || draft.uploading || pending;

  const action = showStop ? (
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
  );

  const attach = (
    <AttachButton
      onAttach={draft.add}
      disabled={pending}
      className="rounded-full text-muted-foreground"
    />
  );

  const attachLabelled = (
    <AttachButton
      onAttach={draft.add}
      disabled={pending}
      label="Attachments"
      className="h-7 gap-2 rounded-md px-2 font-normal text-muted-foreground text-sm hover:bg-accent"
    />
  );

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
        'flex flex-col border border-border bg-surface p-1 shadow-xs',
        attaching || context ? 'rounded-2xl' : 'rounded-full',
      )}
    >
      <PendingAttachments
        attachments={draft.attachments}
        onRemove={draft.remove}
        className="px-1 pt-1 pb-2"
      />

      <div className="flex items-end gap-2">
        {!context && attach}

        <AutoGrowTextarea
          rows={context ? 2 : 1}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={onKeyDown}
          disabled={pending}
          aria-label={label}
          placeholder={placeholder}
          className={cn(
            'max-h-56 flex-1 py-0.5 text-sm leading-6',
            context && 'px-2',
          )}
        />

        {!context && action}
      </div>

      {context && (
        <div className="mt-2 flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {attachLabelled}
            {context}
          </div>

          {action}
        </div>
      )}
    </form>
  );
}
