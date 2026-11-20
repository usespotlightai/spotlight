import { useMutation } from '@tanstack/react-query';

import { useRefreshMembers } from '@/hooks/api/useRefreshMembers';
import { unsuspendMember } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useUnsuspendMember(slug: string | undefined) {
  const refreshMembers = useRefreshMembers(slug);

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
    onSettled: refreshMembers,
  });
}
