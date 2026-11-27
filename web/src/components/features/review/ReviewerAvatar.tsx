import type { ReactElement } from 'react';

import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import { useMe } from '@/hooks/useMe';
import { YOU } from '@/lib/person';

export function ReviewerAvatar(): ReactElement {
  const me = useMe();

  return <PersonAvatar person={me ?? YOU} className="size-5" />;
}
