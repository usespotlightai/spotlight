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
    case 'workspaces':
      return [];
  }
};

const keyOf = (key: QueryKey): string => JSON.stringify(key);

type Listeners = Readonly<
  Record<string, (event: MessageEvent<string>) => void>
>;

interface LiveConnection {
  readonly stream: EventSource;
  close(): void;
}

const connected = (listeners: Listeners): LiveConnection => {
  const stream = new EventSource(LIVE_URL, { withCredentials: true });

  for (const [type, listener] of Object.entries(listeners)) {
    stream.addEventListener(type, listener);
  }

  return {
    stream,
    close: () => {
      for (const [type, listener] of Object.entries(listeners)) {
        stream.removeEventListener(type, listener);
      }
      stream.close();
    },
  };
};

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
    let current: LiveConnection | null = null;
    let replacing: LiveConnection | null = null;
    let rejoining = false;
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

    const replace = (rejoin: boolean) => {
      if (rejoin) {
        rejoining = true;
      }

      if (!replacing) {
        replacing = open();
      }
    };

    const ready = (connection: LiveConnection) => {
      setLive(true);
      reopenMs = REOPEN_MS;

      if (connection === replacing) {
        current?.close();
        current = connection;
        replacing = null;

        if (rejoining) {
          rejoining = false;
          refetchEverything();
        }
      } else if (readyBefore) {
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

      if (change.topic === 'workspaces') {
        replace(true);
        return;
      }

      for (const queryKey of queriesTouchedBy(change)) {
        pending.set(keyOf(queryKey), queryKey);
      }

      if (flushing === undefined) {
        flushing = setTimeout(flush, LIVE_BATCH_MS);
      }
    };

    const notification = (event: MessageEvent<string>) => {
      const arrived = parsed(event.data) as InboxNotification | null;

      if (arrived?.id && arrived.path) {
        notified(arrived);
      }
    };

    const lost = (connection: LiveConnection) => {
      if (connection === replacing) {
        if (connection.stream.readyState === EventSource.CLOSED) {
          connection.close();
          replacing = null;
        }
        return;
      }

      setLive(false);

      if (connection.stream.readyState !== EventSource.CLOSED) {
        return;
      }

      connection.close();
      current = replacing;
      replacing = null;

      if (!current) {
        reopening = setTimeout(() => {
          current = open();
        }, reopenMs);
        reopenMs = Math.min(reopenMs * 2, REOPEN_LIMIT_MS);
      }
    };

    function open(): LiveConnection {
      const connection: LiveConnection = connected({
        ready: () => ready(connection),
        changed,
        resync: refetchEverything,
        reopen: () => replace(false),
        notification,
        error: () => lost(connection),
      });

      return connection;
    }

    current = open();

    return () => {
      clearTimeout(flushing);
      clearTimeout(reopening);
      current?.close();
      replacing?.close();
      setLive(false);
    };
  }, [queryClient]);
}
