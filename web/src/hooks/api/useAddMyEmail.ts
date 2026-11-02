import { useMutation, useQueryClient } from '@tanstack/react-query';
import { myEmailKeys } from '@/hooks/api/useMyEmails';
import { addMyEmail } from '@/lib/api';
import { messageOf } from '@/lib/error';

export function useAddMyEmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await addMyEmail({ body: { email } });

      if (!data) {
        throw new Error(
          messageOf(error, 'Sorry, the email couldn’t be added.'),
        );
      }
      return data;
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: myEmailKeys.all }),
  });
}
