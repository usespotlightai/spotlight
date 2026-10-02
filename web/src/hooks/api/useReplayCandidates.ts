import { useQuery } from '@tanstack/react-query';
import { listReplayCandidates } from '@/lib/api';
import type { ReplayCandidate } from '@/lib/replay';

export const replayCandidateKeys = {
  forStation: (address?: string) =>
    ['replay-candidates', address ?? null] as const,
};

export function useReplayCandidates(
  workspaceId: string | undefined,
  address: string | undefined,
) {
  return useQuery({
    queryKey: replayCandidateKeys.forStation(address),
    enabled: Boolean(workspaceId && address),
    queryFn: async (): Promise<ReplayCandidate[]> => {
      const { data } = await listReplayCandidates({
        path: { workspaceId: workspaceId as string },
        query: { station: address },
        throwOnError: true,
      });
      return data.items;
    },
  });
}
