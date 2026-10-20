import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { type NoteResponseDto, sendMessage } from '@/lib/api';
import type { RunNotes } from '@/lib/run-notes';

type Sender = NonNullable<NoteResponseDto['author']>;

type SendMessageInput = {
  teamId: string;
  runId: string;
  body: string;
  attachments: string[];
  shown?: {
    taskId: string;
    stationId: string;
    author: Sender;
    startsRun: boolean;
  };
};

const withMessage = (
  notes: RunNotes,
  body: string,
  { author, startsRun }: NonNullable<SendMessageInput['shown']>,
): RunNotes => ({
  ...notes,
  working: notes.working || startsRun,
  notes: [
    ...notes.notes,
    {
      position: (notes.notes.at(-1)?.position ?? -1) + 1,
      kind: 'message',
      form: 'words',
      voice: 'person',
      station: notes.station?.name ?? '',
      stationColor: notes.station?.color ?? '',
      stationPosition: notes.station?.position ?? 0,
      runId: null,
      body,
      attachments: [],
      at: new Date().toISOString(),
      author,
      approval: null,
      failure: null,
      connection: null,
    },
  ],
});

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      runId,
      body,
      attachments,
    }: SendMessageInput) => {
      await sendMessage({
        path: { teamId, runId },
        body: { body, attachments },
        throwOnError: true,
      });
    },

    onMutate: async ({ body, shown }) => {
      if (!shown) {
        return { previous: [] };
      }

      await queryClient.cancelQueries({ queryKey: runNotesKeys.all });
      const previous = queryClient.getQueriesData<RunNotes>({
        queryKey: runNotesKeys.all,
      });

      for (const [key, notes] of previous) {
        if (
          notes?.taskId === shown.taskId &&
          notes.station?.id === shown.stationId
        ) {
          queryClient.setQueryData(key, withMessage(notes, body, shown));
        }
      }

      return { previous };
    },

    onError: (_error, _input, context) => {
      for (const [key, notes] of context?.previous ?? []) {
        queryClient.setQueryData(key, notes);
      }
    },

    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inbox'] }),
        queryClient.invalidateQueries({ queryKey: runNotesKeys.all }),
        queryClient.invalidateQueries({ queryKey: teamRunKeys.all }),
      ]),
  });
}
