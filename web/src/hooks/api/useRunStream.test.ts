import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRunStream } from '@/hooks/api/useRunStream';
import type { Progress } from '@/lib/run';

const opened: string[] = [];
const closed: string[] = [];

class Stream {
  onmessage: (() => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    opened.push(url);
  }

  close() {
    closed.push(this.url);
  }
}

describe('useRunStream', () => {
  beforeEach(() => {
    opened.length = 0;
    closed.length = 0;
    vi.stubGlobal('EventSource', Stream);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the stream again once a queued run is in progress', () => {
    const { rerender } = renderHook(
      ({ progress }: { progress: Progress | null }) =>
        useRunStream('run_1', true, progress, () => {}),
      { initialProps: { progress: 'queued' } },
    );

    rerender({ progress: 'in-progress' });

    expect(opened).toEqual([
      '/api/runs/run_1/stream',
      '/api/runs/run_1/stream',
    ]);
    expect(closed).toEqual(['/api/runs/run_1/stream']);
  });

  it('opens no stream while it is closed', () => {
    renderHook(() => useRunStream('run_1', false, null, () => {}));

    expect(opened).toEqual([]);
  });
});
