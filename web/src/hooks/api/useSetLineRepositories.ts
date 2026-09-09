import { useMutation } from '@tanstack/react-query';
import { setLineRepositories } from '@/lib/api';

type SetLineRepositoriesInput = {
  teamId: string;
  lineId: string;
  repositories: string[];
};

/** Git-first: opens/updates a pull request setting the line's repositories and
 *  returns it; the board is not changed here, so nothing is invalidated. */
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
