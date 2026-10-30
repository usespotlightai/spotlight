import type { DragEndEvent } from '@dnd-kit/core';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_DROP, RESOLVED_DROP, useInboxDrag } from '@/hooks/useInboxDrag';
import type { InboxEntry } from '@/lib/inbox';

const resolve = vi.fn();
const reopen = vi.fn();

vi.mock('@/hooks/api/useResolveInboxEntry', () => ({
  useResolveInboxEntry: () => ({ mutate: resolve }),
}));

vi.mock('@/hooks/api/useReopenInboxEntry', () => ({
  useReopenInboxEntry: () => ({ mutate: reopen }),
}));

const notice = (over: Partial<InboxEntry> = {}) =>
  ({ kind: 'notice', id: 'notice_1', resolved: false, ...over }) as InboxEntry;

const dropped = (activeId: string, overId: string | null) =>
  ({
    active: { id: activeId },
    over: overId === null ? null : { id: overId },
  }) as unknown as DragEndEvent;

const dropping = (entries: InboxEntry[], event: DragEndEvent) => {
  const { result } = renderHook(() => useInboxDrag('acme', entries));

  act(() => result.current.handlers.onDragEnd(event));
};

describe('useInboxDrag', () => {
  beforeEach(() => {
    resolve.mockClear();
    reopen.mockClear();
  });

  it('resolves an open entry dropped on Resolved', () => {
    const entry = notice();

    dropping([entry], dropped('notice:notice_1', RESOLVED_DROP));

    expect(resolve).toHaveBeenCalledWith({ slug: 'acme', entry });
  });

  it('leaves an entry dropped anywhere else where it is', () => {
    dropping([notice()], dropped('notice:notice_1', null));

    expect(resolve).not.toHaveBeenCalled();
  });

  it('reopens a resolved entry dropped on Open', () => {
    const entry = notice({ resolved: true });

    dropping([entry], dropped('notice:notice_1', OPEN_DROP));

    expect(reopen).toHaveBeenCalledWith({ slug: 'acme', entry });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('leaves an open entry dropped on Open where it is', () => {
    dropping([notice()], dropped('notice:notice_1', OPEN_DROP));

    expect(reopen).not.toHaveBeenCalled();
  });

  it('leaves an entry that is already resolved alone', () => {
    dropping(
      [notice({ resolved: true })],
      dropped('notice:notice_1', RESOLVED_DROP),
    );

    expect(resolve).not.toHaveBeenCalled();
  });
});
