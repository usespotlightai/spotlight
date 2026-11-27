import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';

import { myEmailKeys } from '@/hooks/api/useMyEmails';
import {
  resendMyEmailVerification,
  type UserEmailResponseDto,
} from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useResendMyEmailVerification(): UseMutationResult<
  UserEmailResponseDto,
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userEmailId: string) => {
      const { data, error } = await resendMyEmailVerification({
        path: { userEmailId },
      });

      if (!data) {
        throw new Error(
          messageOf(error, 'Sorry, the verification link couldn’t be sent.'),
        );
      }
      return data;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: myEmailKeys.all }),
  });
}
