import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';

type SignInData = NonNullable<
  Awaited<ReturnType<typeof authClient.signIn.social>>['data']
>;

export function useSignIn(
  callbackURL = '/',
): UseMutationResult<SignInData, Error, void> {
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
