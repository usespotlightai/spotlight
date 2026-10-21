import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useInboxItemRefresh } from '@/hooks/api/useInboxItemRefresh';
import type { InboxItem } from '@/lib/inbox';

const stream = vi.fn();

vi.mock('@/hooks/api/useRunStream', () => ({
  useRunStream: (...args: unknown[]) => stream(...args),
}));

const streams = (activity: InboxItem['activity']) => {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const item = { taskId: 'task_1', runId: 'run_1', activity } as InboxItem;

  renderHook(() => useInboxItemRefresh('acme', item), { wrapper });

  return stream.mock.calls.at(-1)?.[1];
};

describe('useInboxItemRefresh', () => {
  beforeEach(() => {
    stream.mockReset();
  });

  it('follows the run while it works', () => {
    expect(streams('working')).toBe(true);
  });

  it('follows the run while it stops, so the end shows', () => {
    expect(streams('stopping')).toBe(true);
  });

  it('stops following the run once it does nothing', () => {
    expect(streams(null)).toBe(false);
  });
});
