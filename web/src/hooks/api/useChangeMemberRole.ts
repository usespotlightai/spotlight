import { useMutation, useQueryClient } from '@tanstack/react-query';

import { refreshMembers } from '@/hooks/api/refreshMembers';
import { changeMemberRole } from '@/lib/api';
import { messageOf } from '@/lib/error';
import type { Role } from '@/lib/role';

export function useChangeMemberRole(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (change: { userId: string; role: Role }) => {
      const { error } = await changeMemberRole({
        path: { slug: slug as string, userId: change.userId },
        body: { role: change.role },
      });

      if (error) {
        throw new Error(
          messageOf(error, 'Sorry, the role couldn’t be changed.'),
        );
      }
    },
    onSettled: () => refreshMembers(queryClient, slug),
  });
}
