import { useQuery } from '@tanstack/react-query';

import { authClient } from '@/lib/authClient';

export interface SessionUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly image: string | null;
}

export interface Session {
  readonly user: SessionUser;
}

export const sessionQueryKey = ['auth', 'session'] as const;

const readSession = async (): Promise<Session | null> => {
  const { data, error } = await authClient.getSession();

  if (error) {
    throw new Error(error.message ?? 'Sorry, your session could not be read.');
  }

  if (!data) {
    return null;
  }

  const { id, name, email, image } = data.user;

  return { user: { id, name, email, image: image ?? null } };
};

export function useSession() {
  return useQuery({ queryKey: sessionQueryKey, queryFn: readSession });
}
