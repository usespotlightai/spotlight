import { journalKeys, useRunJournals } from '@/hooks/api/useRunJournals';
import { listChatJournalRuns, readChatJournal } from '@/lib/api';

export function useChatJournal(
  teamId: string | undefined,
  chatId: string | undefined,
  eager: readonly (string | null | undefined)[] = [],
) {
  return useRunJournals(
    {
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
    },
    eager,
  );
}
