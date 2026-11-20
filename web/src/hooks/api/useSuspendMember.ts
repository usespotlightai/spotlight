import { useMutation } from '@tanstack/react-query';

import { useRefreshMembers } from '@/hooks/api/useRefreshMembers';
import { suspendMember } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useSuspendMember(slug: string | undefined) {
  const refreshMembers = useRefreshMembers(slug);

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
    onSettled: refreshMembers,
  });
}
