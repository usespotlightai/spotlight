import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export function useSignIn(callbackURL = '/') {
  return useMutation({
    mutationKey: ['auth', 'sign-in', callbackURL],
    mutationFn: async () => {
      const { data, error } = await authClient.signIn.social({
        provider: 'github',
        callbackURL,
      });

      if (error) {
        throw new Error(
          error.message ?? 'Sorry, sign-in failed. Please try again.',
        );
      }

      return data;
    },
  });
}
