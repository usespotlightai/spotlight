import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';

import { inboxKeys } from '@/hooks/api/useInbox';
import { teamMemoryKeys } from '@/hooks/api/useTeamMemories';
import {
  approveUpkeepProposal,
  readMemoryUpkeep,
  rejectUpkeepProposal,
  type MemoryUpkeepResponseDto,
} from '@/lib/api';
import type { MemoryUpkeep, UpkeepDecision } from '@/lib/memory-upkeep';
import { required } from '@/lib/required';

const memoryUpkeepKeys = {
  one: (upkeepId?: string) => ['memory-upkeep', upkeepId ?? null] as const,
};

export function useMemoryUpkeep(
  teamId?: string,
  upkeepId?: string,
): UseQueryResult<MemoryUpkeepResponseDto> {
  return useQuery({
    queryKey: memoryUpkeepKeys.one(upkeepId),
    enabled:
      teamId !== undefined &&
      teamId !== '' &&
      upkeepId !== undefined &&
      upkeepId !== '',
    queryFn: async () => {
      const { data } = await readMemoryUpkeep({
        path: { teamId: required(teamId), upkeepId: required(upkeepId) },
        throwOnError: true,
      });
      return data;
    },
  });
}

type DecideUpkeepInput = {
  slug: string;
  teamId: string;
  upkeepId: string;
  proposalId: string;
  decision: UpkeepDecision;
};

export function useDecideUpkeepProposal(): UseMutationResult<
  MemoryUpkeepResponseDto,
  Error,
  DecideUpkeepInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      upkeepId,
      proposalId,
      decision,
    }: DecideUpkeepInput) => {
      const decide =
        decision === 'approved' ? approveUpkeepProposal : rejectUpkeepProposal;
      const { data } = await decide({
        path: { teamId, upkeepId, proposalId },
        throwOnError: true,
      });
      return data;
    },

    onSuccess: (upkeep: MemoryUpkeep, { slug, teamId, upkeepId }) => {
      queryClient.setQueryData(memoryUpkeepKeys.one(upkeepId), upkeep);
      void queryClient.invalidateQueries({
        queryKey: teamMemoryKeys.forTeam(teamId),
      });
      void queryClient.invalidateQueries({
        queryKey: inboxKeys.forWorkspace(slug),
      });
    },
  });
}
