import { useEffect, useRef } from 'react';

import { useResolveInboxNotice } from '@/hooks/api/useResolveInboxNotice';
import type { InboxNotice } from '@/lib/inbox';
import { nonEmpty } from '@/lib/non-empty';

const RESOLVE_AFTER_MS = 3000;

// Resolves an open notice a few seconds after the person opens it, as reading an email does. A notice that the person cannot resolve stays open: for example, a notice that resolves itself when its cause ends.
export function useResolveNoticeOnOpening(
  slug: string | undefined,
  notice: Pick<InboxNotice, 'id' | 'resolvable'> | undefined,
): ReturnType<typeof useResolveInboxNotice> {
  const pending = notice?.resolvable === true ? notice.id : null;
  const resolve = useResolveInboxNotice();
  const { mutate: resolveNotice } = resolve;
  const resolvedOnOpening = useRef<string | null>(null);

  useEffect(() => {
    if (
      !nonEmpty(slug) ||
      !nonEmpty(pending) ||
      resolvedOnOpening.current === pending
    ) {
      return;
    }

    const timer = setTimeout(() => {
      resolvedOnOpening.current = pending;
      resolveNotice({ slug, noticeId: pending });
    }, RESOLVE_AFTER_MS);

    return () => clearTimeout(timer);
  }, [slug, pending, resolveNotice]);

  return resolve;
}
