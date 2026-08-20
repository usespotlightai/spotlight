import { useMutation } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

export type SignUpInput = {
  email: string;
  password: string;
  name: string;
};

export function useSignUp() {
  return useMutation({
    mutationKey: ['auth', 'sign-up'],
    mutationFn: async ({ email, password, name }: SignUpInput) => {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
      });
      if (error) {
        throw new Error(error.message ?? 'Sign up failed');
      }
      return data;
    },
  });
}
