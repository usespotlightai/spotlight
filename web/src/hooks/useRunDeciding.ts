import type { Deciding } from '@/components/features/inbox/conversation/Conversation';
import { useAnswerInboxItem } from '@/hooks/api/useAnswerInboxItem';
import type { Run } from '@/lib/run';

export function useRunDeciding(
  slug: string,
  run: Pick<Run, 'review'> | undefined,
): Deciding | undefined {
  const answer = useAnswerInboxItem();
  const itemId = run?.review?.conversationId;

  if (!itemId) {
    return undefined;
  }

  return {
    pending: answer.isPending,
    onDecide: ({ approve, said, inputs }) =>
      answer.mutate({
        slug,
        itemId,
        body: said,
        attachments: [],
        approve,
        inputs,
      }),
  };
}
