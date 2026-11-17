import { LiveWrites } from '@platform/live/live-writes';
import { describe, expect, it } from 'vitest';

describe('LiveWrites', () => {
  it('gives the last sequence of each channel a write published on', async () => {
    const published: Promise<never[]>[] = [];
    const header = LiveWrites.within(published, async () => {
      LiveWrites.track(
        Promise.resolve([
          { channel: 'workspace:ws_1', topic: 'task', ids: {}, sequence: 4 },
          { channel: 'workspace:ws_1', topic: 'inbox', ids: {}, sequence: 5 },
        ]) as Promise<never[]>,
      );
      LiveWrites.track(
        Promise.resolve([
          { channel: 'person:user_1', topic: 'chat', ids: {}, sequence: 9 },
          { channel: 'person:user_1', topic: 'chat', ids: {}, sequence: null },
        ]) as Promise<never[]>,
      );

      return LiveWrites.headerOf(published);
    });

    expect(await header).toBe('workspace:ws_1@5,person:user_1@9');
  });

  it('gives nothing when a write published no numbered change', async () => {
    expect(await LiveWrites.headerOf([])).toBeNull();
  });

  it('keeps nothing tracked outside a write', () => {
    expect(() => LiveWrites.track(Promise.resolve([]))).not.toThrow();
  });

  it('keeps work started outside a write out of its sequences', () => {
    const published: Promise<never[]>[] = [];

    LiveWrites.within(published, () =>
      LiveWrites.outside(() => LiveWrites.track(Promise.resolve([]))),
    );

    expect(published).toHaveLength(0);
  });
});
