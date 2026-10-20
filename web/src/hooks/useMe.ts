import { useSession } from '@/hooks/api/useSession';
import type { Person } from '@/lib/person';

export function useMe(): Person | null {
  const { data: session } = useSession();

  return session
    ? {
        id: session.user.id,
        name: session.user.name,
        image: session.user.image ?? null,
      }
    : null;
}
