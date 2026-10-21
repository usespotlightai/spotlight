import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatRefresh } from '@/hooks/api/useChatRefresh';
import type { Chat } from '@/lib/chat';

const opened: string[] = [];

class Stream {
  onmessage: (() => void) | null = null;

  constructor(url: string) {
    opened.push(url);
  }

  close() {}
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('the stream of a run that is stopping', () => {
  beforeEach(() => {
    opened.length = 0;
    vi.stubGlobal('EventSource', Stream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stays open in a chat while its run has not ended', () => {
    const chat = {
      runId: 'run_1',
      progress: null,
      messages: [],
    } as unknown as Chat;

    renderHook(() => useChatRefresh('chat_1', chat), { wrapper });

    expect(opened).toEqual(['/api/runs/run_1/stream']);
  });
});
