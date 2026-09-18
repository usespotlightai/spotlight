import { useMutation } from '@tanstack/react-query';
import { setLineRepositories } from '@/lib/api';

type SetLineRepositoriesInput = {
  teamId: string;
  lineId: string;
  repositories: string[];
};

export function useSetLineRepositories() {
  return useMutation({
    mutationFn: async ({
      teamId,
      lineId,
      repositories,
    }: SetLineRepositoriesInput) => {
      const { data } = await setLineRepositories({
        path: { teamId, lineId },
        body: { repositories },
        throwOnError: true,
      });
      return data;
    },
  });
}
