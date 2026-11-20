import { useMutation, useQueryClient } from '@tanstack/react-query';

import { refreshMembers } from '@/hooks/api/refreshMembers';
import { unsuspendMember } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useUnsuspendMember(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await unsuspendMember({
        path: { slug: slug as string, userId },
      });

      if (error) {
        throw new Error(
          messageOf(error, 'Sorry, the member couldn’t be unsuspended.'),
        );
      }
    },
    onSettled: () => refreshMembers(queryClient, slug),
  });
}
