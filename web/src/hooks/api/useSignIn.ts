import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export type SignInInput = {
  email: string;
  password: string;
};

export function useSignIn() {
  return useMutation({
    mutationKey: ['auth', 'sign-in'],
    mutationFn: async ({ email, password }: SignInInput) => {
      const { data, error } = await authClient.signIn.email({
        email,
        password,
      });
      if (error) {
        throw new Error(error.message ?? 'Sign in failed');
      }
      return data;
    },
  });
}
