import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { myEmailKeys } from '@/hooks/api/useMyEmails';
import { verifyMyEmail, type UserEmailResponseDto } from '@/lib/api';
import { messageOf } from '@/lib/error';
import { required } from '@/lib/required';

export function useVerifyMyEmail(
  token: string | undefined,
): UseMutationResult<UserEmailResponseDto, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    meta: { quiet: true },
    mutationFn: async () => {
      const { data, error, response } = await verifyMyEmail({
        path: { token: required(token) },
      });

      if (data) {
        return data;
      }

      if (response?.status === 404) {
        throw new Error(
          'The verification link doesn’t work. Please send a new one from your settings.',
        );
      }

      throw new Error(
        messageOf(error, 'Sorry, the email couldn’t be verified.'),
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: myEmailKeys.all }),
  });
}
