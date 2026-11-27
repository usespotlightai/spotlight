import type { SequencedNotice } from '@platform/live/change-notices';
import { LiveWrites } from '@platform/live/live-writes';
import { describe, expect, it, vi } from 'vitest';

describe('LiveWrites', () => {
  it('gives the last sequence of each channel a write published on', async () => {
    const published: Promise<readonly SequencedNotice[]>[] = [];
    const header = LiveWrites.within(published, async () => {
      LiveWrites.track(
        Promise.resolve<readonly SequencedNotice[]>([
          { channel: 'workspace:ws_1', topic: 'task', ids: {}, sequence: 4 },
          { channel: 'workspace:ws_1', topic: 'inbox', ids: {}, sequence: 5 },
        ]),
      );
      LiveWrites.track(
        Promise.resolve<readonly SequencedNotice[]>([
          { channel: 'person:user_1', topic: 'chat', ids: {}, sequence: 9 },
          { channel: 'person:user_1', topic: 'chat', ids: {}, sequence: null },
        ]),
      );

      return LiveWrites.headerOf(published);
    });

    expect(await header).toBe('workspace:ws_1@5,person:user_1@9');
  });

  it('gives nothing, and says so, when the sequences are late', async () => {
    vi.useFakeTimers();
    const late = vi.fn();
    const header = LiveWrites.headerOf(
      [new Promise<never[]>(() => undefined)],
      late,
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(await header).toBeNull();
    expect(late).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });

  it('gives nothing when a write published no numbered change', async () => {
    expect(await LiveWrites.headerOf([])).toBeNull();
  });

  it('keeps nothing tracked outside a write', () => {
    expect(() => LiveWrites.track(Promise.resolve([]))).not.toThrow();
  });

  it('keeps work started outside a write out of its sequences', () => {
    const published: Promise<readonly SequencedNotice[]>[] = [];

    LiveWrites.within(published, () =>
      LiveWrites.outside(() => LiveWrites.track(Promise.resolve([]))),
    );

    expect(published).toHaveLength(0);
  });
});
