import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { refreshMembers } from '@/hooks/api/refreshMembers';
import { unsuspendMember } from '@/lib/api';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export function useUnsuspendMember(
  slug: string | undefined,
): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await unsuspendMember({
        path: { slug: required(slug), userId },
      });

      if (error !== undefined) {
        throw new Error(
          messageOf(error, 'Sorry, the member couldn’t be unsuspended.'),
        );
      }
    },
    onSettled: () => refreshMembers(queryClient, slug),
  });
}
