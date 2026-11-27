import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useInbox } from '@/hooks/api/useInbox';
import { useDesktopBadge } from '@/hooks/useDesktopBadge';
import type { InboxEntry } from '@/lib/inbox';
import { partial } from '@/test/partial';

vi.mock('@/hooks/api/useInbox', () => ({ useInbox: vi.fn() }));

const inbox = vi.mocked(useInbox);

describe('useDesktopBadge', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'spotlightDesktop');
    inbox.mockReset();
  });

  it('shows the number of unread items on the app icon', () => {
    const setBadge = vi.fn();
    Object.assign(window, {
      spotlightDesktop: {
        platform: 'darwin',
        setBadge,
        show() {},
        authorize() {},
      },
    });
    inbox.mockReturnValue(
      partial<ReturnType<typeof useInbox>>({
        data: [
          partial<InboxEntry>({ unread: true }),
          partial<InboxEntry>({ unread: false }),
          partial<InboxEntry>({ unread: true }),
        ],
      }),
    );

    const { unmount } = renderHook(() => useDesktopBadge('acme'));

    expect(inbox).toHaveBeenCalledWith('acme');
    expect(setBadge).toHaveBeenCalledWith(2);

    unmount();

    expect(setBadge).toHaveBeenLastCalledWith(0);
  });

  it('reads no inbox in a browser', () => {
    inbox.mockReturnValue(
      partial<ReturnType<typeof useInbox>>({ data: undefined }),
    );

    renderHook(() => useDesktopBadge('acme'));

    expect(inbox).toHaveBeenCalledWith(undefined);
  });
});
