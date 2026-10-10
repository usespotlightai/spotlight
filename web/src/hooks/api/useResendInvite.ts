import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inviteKeys } from '@/hooks/api/useWorkspaceInvites';
import { resendInvite } from '@/lib/api';

export function useResendInvite(slug: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { data } = await resendInvite({
        path: { slug: slug as string, inviteId },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: inviteKeys.forWorkspace(slug),
      }),
  });
}
