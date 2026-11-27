import type { ReactNode, ReactElement } from 'react';

import { ShortcutKeys } from '@/components/shared/shortcut/ShortcutKeys';
import type { ShortcutId } from '@/lib/commands/shortcuts';

type ShortcutHintProps = {
  id: ShortcutId;
  children: ReactNode;
};

export function ShortcutHint({
  id,
  children,
}: ShortcutHintProps): ReactElement {
  return (
    <span data-slot="shortcut-hint" className="flex items-center gap-2">
      {children}
      <ShortcutKeys id={id} size="sm" />
    </span>
  );
}
