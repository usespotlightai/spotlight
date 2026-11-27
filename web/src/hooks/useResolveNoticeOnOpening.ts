import { useEffect, useRef } from 'react';

import { useResolveInboxNotice } from '@/hooks/api/useResolveInboxNotice';
import { nonEmpty } from '@/lib/non-empty';

const RESOLVE_AFTER_MS = 3000;

export function useResolveNoticeOnOpening(
  slug: string | undefined,
  pending: string | null,
): ReturnType<typeof useResolveInboxNotice> {
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
