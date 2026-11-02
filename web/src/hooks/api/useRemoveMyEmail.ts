import { useMutation, useQueryClient } from '@tanstack/react-query';
import { myEmailKeys } from '@/hooks/api/useMyEmails';
import { removeMyEmail } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useRemoveMyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userEmailId: string) => {
      const { error } = await removeMyEmail({ path: { userEmailId } });

      if (error) {
        throw new Error(
          messageOf(error, 'Sorry, the email couldn’t be removed.'),
        );
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: myEmailKeys.all }),
  });
}
