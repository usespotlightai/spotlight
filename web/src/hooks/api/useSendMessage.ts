import {
  type Mutation,
  type QueryClient,
  useMutation,
  useMutationState,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { runNotesKeys } from '@/hooks/api/useRunNotes';
import { taskKeys } from '@/hooks/api/useTasks';
import { teamRunKeys } from '@/hooks/api/useTeamRuns';
import { sendMessage, sendTaskMessage, type TaskResponseDto } from '@/lib/api';
import { refreshAfterWrite } from '@/lib/live-writes';
import { required } from '@/lib/required';
import type { MessageInFlight, OutgoingMessage } from '@/lib/run-notes';

const sendMessageKey = ['send-message'] as const;

type SendMessageMutation = Mutation<void, Error, OutgoingMessage>;

const runIdOf = (variables: unknown): string =>
  typeof variables === 'object' &&
  variables !== null &&
  'runId' in variables &&
  typeof variables.runId === 'string'
    ? variables.runId
    : '';

export function useSendMessage(): UseMutationResult<
  void,
  Error,
  OutgoingMessage
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: sendMessageKey,
    mutationFn: async ({
      teamId,
      runId,
      body,
      attachments,
      coAuthors,
      draftGeneration,
    }: OutgoingMessage) => {
      const { response } = await sendMessage({
        path: { teamId, runId },
        body: { body, attachments, coAuthors, draftGeneration },
        throwOnError: true,
      });
      void refreshAfterWrite(queryClient, response, [
        ['inbox'],
        teamRunKeys.all,
        runNotesKeys.all,
      ]);
    },
  });
}

export type TaskRef = {
  readonly teamId: string;
  readonly taskId: string;
};

type TaskMessage = TaskRef & {
  readonly body: string;
  readonly attachments: string[];
  readonly coAuthors?: string[];
  readonly draftGeneration?: number;
};

export const startsTaskRunKey = ['starts-task-run'] as const;

export function useTriedToStartRun(taskId: string): boolean {
  return useMutationState({
    filters: { mutationKey: startsTaskRunKey, status: 'success' },
    select: (mutation: Mutation<unknown, Error, TaskRef>) =>
      mutation.state.variables?.taskId,
  }).includes(taskId);
}

export const refreshTask = (
  queryClient: QueryClient,
  teamId: string,
): Promise<void[]> =>
  Promise.all(
    [
      taskKeys.forTeam(teamId),
      teamRunKeys.all,
      runNotesKeys.all,
      ['inbox'],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );

export function useSendTaskMessage(): UseMutationResult<
  TaskResponseDto,
  Error,
  TaskMessage
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: startsTaskRunKey,
    mutationFn: async ({ teamId, taskId, ...body }: TaskMessage) => {
      const { data } = await sendTaskMessage({
        path: { teamId, taskId },
        body,
        throwOnError: true,
      });
      return data;
    },
    onSettled: (_task, _error, { teamId }) => refreshTask(queryClient, teamId),
  });
}

export function useMessagesInFlight(
  runIds: readonly string[],
): MessageInFlight[] {
  return useMutationState({
    filters: {
      mutationKey: sendMessageKey,
      predicate: (mutation) =>
        ['pending', 'success'].includes(mutation.state.status) &&
        runIds.includes(runIdOf(mutation.state.variables)),
    },
    select: (mutation: SendMessageMutation) => ({
      ...required(mutation.state.variables),
      sentAt: mutation.state.submittedAt,
    }),
  });
}
