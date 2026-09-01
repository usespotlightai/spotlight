import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export function useSignIn() {
  return useMutation({
    mutationKey: ['auth', 'sign-in'],
    mutationFn: async () => {
      const { data, error } = await authClient.signIn.social({
        provider: 'github',
        callbackURL: '/',
      });

      if (error) {
        throw new Error(error.message ?? 'Sign in failed');
      }

      return data;
    },
  });
}
