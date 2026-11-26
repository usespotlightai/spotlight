import { Archive } from 'lucide-react';

import { useInbox } from '@/hooks/api/useInbox';
import { useResolveInboxEntry } from '@/hooks/api/useResolveInboxEntry';
import type { MenuAction } from '@/lib/context-menu';
import { type InboxEntry, resolvableAlike } from '@/lib/inbox';

export function useResolveAllAction(
  slug: string,
  entry: InboxEntry,
): MenuAction | null {
  const open = useInbox(slug).data ?? [];
  const resolve = useResolveInboxEntry();
  const alike = resolvableAlike(open, entry);

  if (alike.length < 2) {
    return null;
  }

  return {
    label: `Resolve all ${alike.length} like this`,
    icon: Archive,
    disabled: resolve.isPending,
    onSelect: () => {
      for (const each of alike) {
        resolve.mutate({ slug, entry: each });
      }
    },
  };
}
