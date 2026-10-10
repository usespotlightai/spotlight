import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { resendInvite } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useResendInvite(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data, error } = await resendInvite({
        path: { slug: slug as string, inviteId },
      });

      if (!data) {
        throw new Error(
          messageOf(error, 'Sorry, the invite couldn’t be sent again.'),
        );
      }
      return data;
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: inviteKeys.forWorkspace(slug),
      }),
  });
}
