import { useQuery } from '@tanstack/react-query';
import { listAssemblyLines } from '@/lib/api';

export const assemblyLineKeys = {
  forTeam: (teamId?: string) => ['assembly-lines', teamId ?? null] as const,
};

export function useAssemblyLines(teamId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: assemblyLineKeys.forTeam(teamId),
    enabled: enabled && Boolean(teamId),
    queryFn: async () => {
      const { data } = await listAssemblyLines({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
