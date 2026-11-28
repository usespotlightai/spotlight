import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMarkReadOnView } from '@/hooks/api/useMarkReadOnView';
import { useReopenInboxEntry } from '@/hooks/api/useReopenInboxEntry';
import { useResolveInboxEntry } from '@/hooks/api/useResolveInboxEntry';
import type { InboxItemView, InboxPart } from '@/lib/inbox';
import { partial } from '@/test/partial';

const api = vi.hoisted(() => ({
  resolveInboxItem: vi.fn(async () => ({})),
  resolveInboxRequest: vi.fn(async () => ({})),
  reopenInboxItem: vi.fn(async () => ({})),
  reopenInboxRequest: vi.fn(async () => ({})),
  markInboxItemRead: vi.fn(async () => ({})),
  markInboxRequestRead: vi.fn(async () => ({})),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  ...api,
}));

const part = (id: string, over: Partial<InboxPart> = {}): InboxPart => ({
  id,
  kind: 'judge-question',
  form: 'judge-disagreement',
  about: `disagreement_${id}`,
  asks: 1,
  at: '2026-11-27T09:00:00.000Z',
  open: true,
  unread: true,
  resolvable: true,
  reopenable: false,
  ...over,
});

const question = (over: Partial<InboxPart> = {}) =>
  part('task_1:2', { kind: 'question', form: null, about: null, ...over });

const itemWith = (parts: InboxPart[]) =>
  partial<InboxItemView>({
    kind: 'task',
    id: 'task_1',
    taskId: 'task_1',
    conversationId: 'task_1:2',
    unread: parts.some((each) => each.unread),
    unreadCount: parts.filter((each) => each.unread).length,
    parts,
    notes: [],
  });

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

const SLUG = 'acme';

describe('acting on a task’s inbox item', () => {
  beforeEach(() => {
    for (const each of Object.values(api)) {
      each.mockClear();
    }
  });

  it('resolves each part the server says the item’s Resolve covers', async () => {
    const { result } = renderHook(() => useResolveInboxEntry(), { wrapper });

    act(() =>
      result.current.mutate({
        slug: SLUG,
        entry: itemWith([
          part('request_1'),
          part('request_2'),
          part('request_3', { open: false, resolvable: false }),
          question(),
        ]),
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.resolveInboxRequest.mock.calls).toEqual([
      [{ path: { slug: SLUG, requestId: 'request_1' }, throwOnError: true }],
      [{ path: { slug: SLUG, requestId: 'request_2' }, throwOnError: true }],
    ]);
    expect(api.resolveInboxItem).toHaveBeenCalledWith({
      path: { slug: SLUG, itemId: 'task_1:2' },
      throwOnError: true,
    });
  });

  it('reopens only what the last resolve closed', async () => {
    const { result } = renderHook(() => useReopenInboxEntry(), { wrapper });

    act(() =>
      result.current.mutate({
        slug: SLUG,
        entry: itemWith([
          part('request_1', { open: false, reopenable: false }),
          part('request_2', { open: false, reopenable: true }),
        ]),
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.reopenInboxRequest.mock.calls).toEqual([
      [{ path: { slug: SLUG, requestId: 'request_2' }, throwOnError: true }],
    ]);
    expect(api.reopenInboxItem).not.toHaveBeenCalled();
  });

  it('reads every unread part on opening the item, each through its own read', async () => {
    renderHook(
      () =>
        useMarkReadOnView(
          SLUG,
          itemWith([
            part('request_1'),
            part('request_2', { unread: false }),
            question(),
          ]),
        ),
      { wrapper },
    );

    await waitFor(() =>
      expect(api.markInboxItemRead).toHaveBeenCalledWith({
        path: { slug: SLUG, itemId: 'task_1:2' },
        throwOnError: true,
      }),
    );
    expect(api.markInboxRequestRead).toHaveBeenCalledTimes(1);
    expect(api.markInboxRequestRead).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { slug: SLUG, requestId: 'request_1' },
      }),
    );
  });

  it('reads nothing when nothing on it is new for the person', () => {
    renderHook(
      () =>
        useMarkReadOnView(
          SLUG,
          itemWith([part('request_1', { unread: false })]),
        ),
      { wrapper },
    );

    expect(api.markInboxItemRead).not.toHaveBeenCalled();
    expect(api.markInboxRequestRead).not.toHaveBeenCalled();
  });
});
