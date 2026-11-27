import type { ReactElement } from 'react';

import { openedAt } from '@/lib/inbox';

export function TimeMarker({ at }: { at: string }): ReactElement {
  return (
    <time
      dateTime={at}
      className="block text-center text-muted-foreground text-xs"
    >
      {openedAt(at)}
    </time>
  );
}
