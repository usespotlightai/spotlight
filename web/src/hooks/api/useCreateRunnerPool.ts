import { useMutation, useQueryClient } from '@tanstack/react-query';
import { runnerPoolKeys } from '@/hooks/api/useRunnerPools';
import { createRunnerPool } from '@/lib/api';
import { messageOf } from '@/lib/error';

const POOL_TOKEN_HEADER = 'Spotlight-Pool-Token';

type CreatedRunnerPool = {
  key: string;
  token: string;
};

export class RunnerPoolNameTakenError extends Error {
  readonly pool: string;

  constructor(pool: string) {
    super(`A pool named ${pool} already exists`);
    this.name = 'RunnerPoolNameTakenError';
    this.pool = pool;
  }
}

export function useCreateRunnerPool(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['runner-pools', 'create'],
    mutationFn: async (key: string): Promise<CreatedRunnerPool> => {
      const { data, error, response } = await createRunnerPool({
        path: { workspaceId },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
        body: { key },
      });

      const token = response?.headers.get(POOL_TOKEN_HEADER);

      if (data && token) {
        return { key: data.key, token };
      }

      if (response?.status === 409) {
        throw new RunnerPoolNameTakenError(key);
      }

      throw new Error(messageOf(error, 'Could not create the pool'));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: runnerPoolKeys.forWorkspace(workspaceId),
      }),
  });
}
