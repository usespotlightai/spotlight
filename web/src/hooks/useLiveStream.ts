import {
  type QueryKey,
  useIsRestoring,
  useQueryClient,
} from '@tanstack/react-query';
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
  readyOf,
  setFresh,
  setLive,
} from '@/lib/live';
import {
  LIVE_SEQUENCES_KEY,
  liveSequences,
  type Sequences,
  sinceQuery,
} from '@/lib/live-sequences';
import type { InboxNotification } from '@/lib/notifications';

export const REOPEN_MS = 1_000;
const REOPEN_LIMIT_MS = 30_000;
export const READY_WAIT_MS = 5_000;
export const GAP_WAIT_MS = 2_000;

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
  readonly resumed: boolean;
  close(): void;
}

const connected = (since: Sequences, listeners: Listeners): LiveConnection => {
  const query = sinceQuery(since);
  const stream = new EventSource(query ? `${LIVE_URL}?${query}` : LIVE_URL, {
    withCredentials: true,
  });

  for (const [type, listener] of Object.entries(listeners)) {
    stream.addEventListener(type, listener);
  }

  return {
    stream,
    resumed: query.length > 0,
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
  const restoring = useIsRestoring();
  const notified = useEffectEvent(onNotification);

  useEffect(() => {
    if (restoring || typeof EventSource === 'undefined') {
      return;
    }

    const stored =
      queryClient.getQueryData<Sequences>(LIVE_SEQUENCES_KEY) ?? {};
    const pending = new Map<string, QueryKey>();
    let current: LiveConnection | null = null;
    let replacing: LiveConnection | null = null;
    let flushing: ReturnType<typeof setTimeout> | undefined;
    let reopening: ReturnType<typeof setTimeout> | undefined;
    let gapping: ReturnType<typeof setTimeout> | undefined;
    let waitingReady: ReturnType<typeof setTimeout> | undefined;
    let reopenMs = REOPEN_MS;
    let settling: Promise<unknown> = Promise.resolve();
    let stopped = false;

    const refreshed = (keys: readonly QueryKey[] | null, upTo: Sequences) => {
      const cache = queryClient.getQueryCache();
      const covered = new Set(
        (keys ?? [])
          .flatMap((queryKey) => cache.findAll({ queryKey }))
          .map((query) => query.queryHash),
      );
      const kept = new Set(
        keys === null
          ? []
          : cache
              .getAll()
              .map((query) => query.queryHash)
              .filter((hash) => !covered.has(hash)),
      );
      const work =
        keys === null
          ? queryClient.invalidateQueries()
          : Promise.all(
              keys.map((queryKey) =>
                queryClient.invalidateQueries({ queryKey }),
              ),
            );

      settling = Promise.all([settling, work.catch(() => undefined)]).then(
        () => {
          if (stopped) {
            return;
          }

          liveSequences.settle(upTo, kept);
          queryClient.setQueryData(LIVE_SEQUENCES_KEY, liveSequences.settled());
        },
      );
    };

    const optimisticPending = () =>
      queryClient.isMutating({
        predicate: (mutation) => mutation.meta?.optimistic === true,
      }) > 0;

    const flush = () => {
      flushing = undefined;

      if (optimisticPending()) {
        flushing = setTimeout(flush, LIVE_BATCH_MS);
        return;
      }

      const keys = [...pending.values()];
      pending.clear();
      refreshed(keys, liveSequences.applied());
    };

    const refetchEverything = () => {
      pending.clear();
      clearTimeout(flushing);
      flushing = undefined;
      refreshed(null, liveSequences.applied());
    };

    const replace = () => {
      if (!replacing) {
        replacing = open();
      }
    };

    const ready = (connection: LiveConnection, data: string) => {
      const { complete, heads } = readyOf(data);

      clearTimeout(waitingReady);
      waitingReady = undefined;
      setLive(true);
      reopenMs = REOPEN_MS;

      if (connection === replacing) {
        current?.close();
        current = connection;
        replacing = null;
      }

      if (complete) {
        liveSequences.caughtUp(heads);
      } else if (connection.resumed) {
        liveSequences.restarted(heads);
        refetchEverything();
      } else {
        liveSequences.restarted(heads);
        refreshed(LIVE_POLLED, liveSequences.applied());
      }

      setFresh(true);
    };

    const watchGap = () => {
      if (gapping !== undefined || !liveSequences.hasGap()) {
        return;
      }

      gapping = setTimeout(() => {
        gapping = undefined;

        if (liveSequences.hasGap()) {
          replace();
        }
      }, GAP_WAIT_MS);
    };

    const changed = (event: MessageEvent<string>) => {
      const change = changeOf(event.data);

      if (!change) {
        return;
      }

      if (change.position && !liveSequences.received(change.position)) {
        return;
      }

      watchGap();

      if (change.topic === 'workspaces') {
        replace();
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
      connection.close();

      if (connection === replacing) {
        replacing = null;
        return;
      }

      if (connection !== current) {
        return;
      }

      setLive(false);
      setFresh(false);
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
      const answering = setTimeout(() => {
        if (connection === replacing) {
          connection.close();
          replacing = null;
          watchGap();
        }
      }, READY_WAIT_MS);
      const connection: LiveConnection = connected(liveSequences.applied(), {
        ready: (event) => {
          clearTimeout(answering);
          ready(connection, event.data);
        },
        changed,
        resync: replace,
        reopen: replace,
        notification,
        error: () => lost(connection),
      });

      return connection;
    }

    liveSequences.reset(stored);

    if (Object.keys(stored).length > 0) {
      setFresh(true);
      waitingReady = setTimeout(() => {
        waitingReady = undefined;
        setFresh(false);
        refetchEverything();
      }, READY_WAIT_MS);
    }

    current = open();

    return () => {
      stopped = true;
      clearTimeout(flushing);
      clearTimeout(reopening);
      clearTimeout(gapping);
      clearTimeout(waitingReady);
      current?.close();
      replacing?.close();
      setLive(false);
      setFresh(false);
    };
  }, [queryClient, restoring]);
}
