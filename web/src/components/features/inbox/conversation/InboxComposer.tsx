import { Composer } from '@/components/features/inbox/conversation/Composer';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';

type InboxComposerProps = {
  slug: string;
  itemId: string;
  station: string;
};

export function InboxComposer({ slug, itemId, station }: InboxComposerProps) {
  const answer = useAnswerInboxItem();

  return (
    <Composer
      label={`Answer ${station}`}
      placeholder="Reply…"
      pending={answer.isPending}
      onSend={(body, sent) =>
        answer.mutate({ slug, itemId, body }, { onSuccess: sent })
      }
    />
  );
}
