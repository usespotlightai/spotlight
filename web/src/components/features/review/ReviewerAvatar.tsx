import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { useSession } from '@/hooks/api/useSession';

export function ReviewerAvatar() {
  const { data: session } = useSession();

  return (
    <PersonAvatar
      person={{
        name: session?.user.name ?? 'You',
        image: session?.user.image ?? null,
      }}
      className="size-5"
    />
  );
}
