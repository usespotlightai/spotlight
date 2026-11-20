import { useMutation, useQueryClient } from '@tanstack/react-query';

import { refreshMembers } from '@/hooks/api/refreshMembers';
import { suspendMember } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useSuspendMember(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await suspendMember({
        path: { slug: slug as string, userId },
      });

      if (error) {
        throw new Error(
          messageOf(error, 'Sorry, the member couldn’t be suspended.'),
        );
      }
    },
    onSettled: () => refreshMembers(queryClient, slug),
  });
}
