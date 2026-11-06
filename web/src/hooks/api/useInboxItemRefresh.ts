import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { inboxKeys } from '@/hooks/api/useInbox';
import { journalKeys } from '@/hooks/api/useRunJournals';
import { useRunStream } from '@/hooks/api/useRunStream';
import type { InboxItem } from '@/lib/inbox';

export function useInboxItemRefresh(
  slug: string | undefined,
  item: InboxItem | undefined,
) {
  const queryClient = useQueryClient();
  const itemId = item?.id;
  const runId = item?.runId ?? undefined;
  const taskId = item?.taskId;
  const progress = item?.progress ?? null;

  const bump = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: journalKeys.ofRun(runId) });
    void queryClient.invalidateQueries({
      queryKey: inboxKeys.item(slug, itemId),
    });
  }, [queryClient, runId, slug, itemId]);

  useRunStream(runId, Boolean(runId), progress, bump);

  const previous = useRef({ runId, progress });

  useEffect(() => {
    const was = previous.current;

    if (was.runId !== runId || was.progress !== progress) {
      void queryClient.invalidateQueries({
        queryKey: journalKeys.ofRun(was.runId),
      });
      void queryClient.invalidateQueries({
        queryKey: journalKeys.runsOfTask(taskId),
      });
    }
    previous.current = { runId, progress };
  }, [queryClient, runId, progress, taskId]);
}
