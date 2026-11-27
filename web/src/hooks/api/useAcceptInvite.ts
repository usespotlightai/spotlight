import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { acceptInvite, type JoinedWorkspaceResponseDto } from '@/lib/api';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export function useAcceptInvite(
  token: string | undefined,
): UseMutationResult<JoinedWorkspaceResponseDto, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await acceptInvite({
        path: { token: required(token) },
      });

      if (!data) {
        throw new Error(
          messageOf(error, 'Sorry, the invitation couldn’t be accepted.'),
        );
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
