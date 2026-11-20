import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';

import {
  type JournalSource,
  journalKeys,
  prefetchJournals,
  useRunJournals,
} from '@/hooks/api/useRunJournals';
import { listChatJournalRuns, readChatJournal } from '@/lib/api';

const CHAT_RUNS_SHOWN_FIRST = 3;

const chatJournalSource = (
  teamId: string | undefined,
  chatId: string | undefined,
): JournalSource => ({
  runsKey: journalKeys.runsOfChat(chatId),
  enabled: Boolean(teamId && chatId),
  runs: async () => {
    const { data } = await listChatJournalRuns({
      path: { teamId: teamId as string, chatId: chatId as string },
      throwOnError: true,
    });
    return data;
  },
  journal: async (runId) => {
    const { data } = await readChatJournal({
      path: { teamId: teamId as string, chatId: chatId as string, runId },
      throwOnError: true,
    });
    return data;
  },
});

export function useChatJournal(
  teamId: string | undefined,
  chatId: string | undefined,
  eager: readonly (string | null | undefined)[] = [],
) {
  return useRunJournals(
    chatJournalSource(teamId, chatId),
    eager,
    CHAT_RUNS_SHOWN_FIRST,
  );
}

export function usePrefetchChatJournal() {
  const client = useContext(QueryClientContext);

  return useCallback(
    (teamId: string, chatId: string) =>
      client &&
      void prefetchJournals(
        client,
        chatJournalSource(teamId, chatId),
        [],
        CHAT_RUNS_SHOWN_FIRST,
      ),
    [client],
  );
}
