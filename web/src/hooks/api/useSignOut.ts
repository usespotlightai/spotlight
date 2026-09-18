import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ['auth', 'sign-out'],
    mutationFn: async () => {
      const { error } = await authClient.signOut();
      if (error) {
        throw new Error(error.message ?? 'Sign out failed');
      }
    },
    onSuccess: () => queryClient.clear(),
  });
}
