import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { inboxKeys } from '@/hooks/api/useInbox';
import { useRunStream } from '@/hooks/api/useRunStream';
import { journalKeys } from '@/hooks/api/useTaskJournal';
import type { InboxItem } from '@/lib/inbox';
import { live } from '@/lib/run';

export function useInboxItemRefresh(
  slug: string | undefined,
  item: InboxItem | undefined,
) {
  const queryClient = useQueryClient();

  const bump = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: journalKeys.forTask(item?.taskId),
    });
    void queryClient.invalidateQueries({
      queryKey: inboxKeys.forWorkspace(slug),
    });
  }, [queryClient, item?.taskId, slug]);

  useRunStream(item?.runId ?? undefined, live(item?.activity), bump);
}
