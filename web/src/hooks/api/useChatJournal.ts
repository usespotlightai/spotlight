import { QueryClientContext } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';

import {
  type JournalSource,
  journalKeys,
  prefetchJournals,
  useRunJournals,
  type RunJournals,
} from '@/hooks/api/useRunJournals';
import { listChatJournalRuns, readChatJournal } from '@/lib/api';
import { required } from '@/lib/required';

const CHAT_RUNS_SHOWN_FIRST = 3;

const chatJournalSource = (
  teamId: string | undefined,
  chatId: string | undefined,
): JournalSource => ({
  runsKey: journalKeys.runsOfChat(chatId),
  enabled:
    teamId !== undefined &&
    teamId !== '' &&
    chatId !== undefined &&
    chatId !== '',
  runs: async () => {
    const { data } = await listChatJournalRuns({
      path: { teamId: required(teamId), chatId: required(chatId) },
      throwOnError: true,
    });
    return data;
  },
  journal: async (runId) => {
    const { data } = await readChatJournal({
      path: { teamId: required(teamId), chatId: required(chatId), runId },
      throwOnError: true,
    });
    return data;
  },
});

export function useChatJournal(
  teamId: string | undefined,
  chatId: string | undefined,
  eager: readonly (string | null | undefined)[] = [],
): RunJournals {
  return useRunJournals(
    chatJournalSource(teamId, chatId),
    eager,
    CHAT_RUNS_SHOWN_FIRST,
  );
}

export function usePrefetchChatJournal(): (
  teamId: string,
  chatId: string,
) => undefined {
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
