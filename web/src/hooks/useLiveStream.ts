import { type QueryKey, useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';
import { chatKeys } from '@/hooks/api/useChats';
import { inboxKeys } from '@/hooks/api/useInbox';
import { journalKeys } from '@/hooks/api/useRunJournals';
import { taskRunKeys } from '@/hooks/api/useTaskRuns';
import { taskKeys } from '@/hooks/api/useTasks';
import { taskTraceKeys } from '@/hooks/api/useTaskTrace';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import {
  changeOf,
  LIVE_BATCH_MS,
  LIVE_URL,
  type LiveChange,
  parsed,
  setLive,
} from '@/lib/live';
import type { InboxNotification } from '@/lib/notifications';

export const REOPEN_MS = 1_000;
const REOPEN_LIMIT_MS = 30_000;

const LIVE_POLLED: readonly QueryKey[] = [
  chatKeys.each,
  chatKeys.all,
  taskKeys.all,
  inboxKeys.all,
  teamRunKeys.all,
];

export const queriesTouchedBy = (change: LiveChange): QueryKey[] => {
  const { chatId, taskId, runId } = change.ids;

  switch (change.topic) {
    case 'chat':
      return chatId
        ? [chatKeys.one(chatId), chatKeys.all, journalKeys.runsOfChat(chatId)]
        : [chatKeys.each, chatKeys.all];
    case 'task':
      return [
        taskKeys.all,
        inboxKeys.all,
        teamRunKeys.all,
        ...(taskId
          ? [
              taskRunKeys.forTask(taskId),
              taskTraceKeys.forTask(taskId),
              journalKeys.runsOfTask(taskId),
            ]
          : []),
      ];
    case 'run':
      return [
        teamRunKeys.all,
        taskKeys.all,
        chatKeys.all,
        chatKeys.each,
        inboxKeys.all,
        ...(runId ? [journalKeys.ofRun(runId)] : []),
      ];
    case 'inbox':
      return [inboxKeys.all];
  }
};

const keyOf = (key: QueryKey): string => JSON.stringify(key);

export function useLiveStream(
  onNotification: (notification: InboxNotification) => void,
) {
  const queryClient = useQueryClient();
  const notified = useEffectEvent(onNotification);

  useEffect(() => {
    if (typeof EventSource === 'undefined') {
      return;
    }

    const pending = new Map<string, QueryKey>();
    let stream: EventSource | null = null;
    let flushing: ReturnType<typeof setTimeout> | undefined;
    let reopening: ReturnType<typeof setTimeout> | undefined;
    let reopenMs = REOPEN_MS;
    let readyBefore = false;

    const invalidated = (keys: readonly QueryKey[]) => {
      for (const queryKey of keys) {
        void queryClient.invalidateQueries({ queryKey });
      }
    };

    const flush = () => {
      flushing = undefined;
      const keys = [...pending.values()];
      pending.clear();
      invalidated(keys);
    };

    const refetchEverything = () => {
      pending.clear();
      clearTimeout(flushing);
      flushing = undefined;
      void queryClient.invalidateQueries();
    };

    const ready = () => {
      setLive(true);
      reopenMs = REOPEN_MS;

      if (readyBefore) {
        refetchEverything();
      } else {
        invalidated(LIVE_POLLED);
      }

      readyBefore = true;
    };

    const changed = (event: MessageEvent<string>) => {
      const change = changeOf(event.data);

      if (!change) {
        return;
      }

      for (const queryKey of queriesTouchedBy(change)) {
        pending.set(keyOf(queryKey), queryKey);
      }

      flushing ??= setTimeout(flush, LIVE_BATCH_MS);
    };

    const notification = (event: MessageEvent<string>) => {
      const arrived = parsed(event.data) as InboxNotification | null;

      if (arrived?.id && arrived.path) {
        notified(arrived);
      }
    };

    const lost = () => {
      setLive(false);

      if (stream?.readyState === EventSource.CLOSED) {
        stream.close();
        reopening = setTimeout(open, reopenMs);
        reopenMs = Math.min(reopenMs * 2, REOPEN_LIMIT_MS);
      }
    };

    const open = () => {
      stream = new EventSource(LIVE_URL, { withCredentials: true });
      stream.addEventListener('ready', ready);
      stream.addEventListener('changed', changed);
      stream.addEventListener('resync', refetchEverything);
      stream.addEventListener('notification', notification);
      stream.addEventListener('error', lost);
    };

    open();

    return () => {
      clearTimeout(flushing);
      clearTimeout(reopening);
      stream?.close();
      setLive(false);
    };
  }, [queryClient]);
}
