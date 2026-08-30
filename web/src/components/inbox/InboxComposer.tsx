import { ArrowUp } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
import { AutoGrowTextarea } from '@/components/common/form/AutoGrowTextarea';
import { Button } from '@/components/ui/button';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';

type InboxComposerProps = {
  slug: string;
  itemId: string;
  station: string;
};

export function InboxComposer({ slug, itemId, station }: InboxComposerProps) {
  const [body, setBody] = useState('');
  const answer = useAnswerInboxItem();

  const said = body.trim();

  const send = (event?: FormEvent) => {
    event?.preventDefault();

    if (!said || answer.isPending) {
      return;
    }

    answer.mutate(
      { slug, itemId, body: said },
      { onSuccess: () => setBody('') },
    );
  };

  // Enter sends, as a chat does; a newline needs a modifier.
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <form
      onSubmit={send}
      className="flex flex-col gap-1.5 rounded-xl border border-border bg-background px-3 py-2 shadow-xs"
    >
      <AutoGrowTextarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={onKeyDown}
        disabled={answer.isPending}
        aria-label={`Answer ${station}`}
        placeholder="Reply…"
        className="max-h-56 overflow-y-auto text-sm leading-6"
      />

      <div className="flex items-center justify-end">
        <Button
          type="submit"
          size="icon-sm"
          className="rounded-full"
          disabled={!said || answer.isPending}
          aria-label="Send"
        >
          <ArrowUp />
        </Button>
      </div>
    </form>
  );
}
