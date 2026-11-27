import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { changeStackKeys } from '@/hooks/api/useRunChangeStacks';
import {
  listPublicRunChangeStacks,
  listPublicTaskChangeStacks,
  type PublicChangeStacksResponseDto,
} from '@/lib/api';
import {
  type ChangeStacks,
  inProgress,
  stackOfPublic,
} from '@/lib/change-stack';
import { required } from '@/lib/required';

const POLL_MS = 5_000;

interface Read {
  readonly data?: PublicChangeStacksResponseDto;
  readonly response?: Response;
}

const readPublic = async (
  read: () => Promise<Read>,
): Promise<ChangeStacks | null> => {
  const { data, response } = await read();

  if (response?.status === 404) {
    return null;
  }
  if (!data) {
    throw new Error('Sorry, the change stack couldn’t be loaded.');
  }

  return { stacks: data.stacks.map(stackOfPublic) };
};

const polling = (data: ChangeStacks | null | undefined) =>
  data && inProgress(data.stacks) ? POLL_MS : false;

export function usePublicTaskChangeStacks(
  taskId?: string,
): UseQueryResult<ChangeStacks | null> {
  return useQuery({
    queryKey: changeStackKeys.publicTask(taskId),
    enabled: Boolean(taskId),
    retry: false,
    refetchInterval: (query) => polling(query.state.data),
    queryFn: () =>
      readPublic(() =>
        listPublicTaskChangeStacks({ path: { taskId: required(taskId) } }),
      ),
  });
}

export function usePublicRunChangeStacks(
  runId?: string,
): UseQueryResult<ChangeStacks | null> {
  return useQuery({
    queryKey: changeStackKeys.publicRun(runId),
    enabled: Boolean(runId),
    retry: false,
    refetchInterval: (query) => polling(query.state.data),
    queryFn: () =>
      readPublic(() =>
        listPublicRunChangeStacks({ path: { runId: required(runId) } }),
      ),
  });
}
