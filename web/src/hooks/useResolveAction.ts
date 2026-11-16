import { Archive, ArchiveX } from 'lucide-react';

import { useReopenInboxEntry } from '@/hooks/api/useReopenInboxEntry';
import { useResolveInboxEntry } from '@/hooks/api/useResolveInboxEntry';
import type { MenuAction } from '@/lib/context-menu';
import { type InboxEntry, reopenable, resolvable } from '@/lib/inbox';

export function useResolveAction(
  slug: string,
  entry: InboxEntry,
): MenuAction | null {
  const resolve = useResolveInboxEntry();
  const reopen = useReopenInboxEntry();

  if (resolvable(entry)) {
    return {
      label: 'Resolve',
      icon: Archive,
      disabled: resolve.isPending || reopen.isPending,
      onSelect: () => resolve.mutate({ slug, entry }),
    };
  }

  if (reopenable(entry)) {
    return {
      label: 'Unresolve',
      icon: ArchiveX,
      disabled: resolve.isPending || reopen.isPending,
      onSelect: () => reopen.mutate({ slug, entry }),
    };
  }

  return null;
}
