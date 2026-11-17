import { AsyncLocalStorage } from 'node:async_hooks';

import type { SequencedNotice } from '@platform/live/change-notices';

export const LIVE_SEQUENCES_HEADER = 'spotlight-live-sequences';
const HEADER_WAIT_MS = 1_000;

type Published = Promise<readonly SequencedNotice[]>;

const scope = new AsyncLocalStorage<Published[]>();

export const LiveWrites = {
  within<T>(published: Published[], work: () => T): T {
    return scope.run(published, work);
  },

  outside<T>(work: () => T): T {
    return scope.exit(work);
  },

  track(published: Published): void {
    scope.getStore()?.push(published);
  },

  async headerOf(published: readonly Published[]): Promise<string | null> {
    const last = new Map<string, number>();
    let waiting: ReturnType<typeof setTimeout> | undefined;
    const all = await Promise.race([
      Promise.all(published),
      new Promise<readonly (readonly SequencedNotice[])[]>((resolve) => {
        waiting = setTimeout(() => resolve([]), HEADER_WAIT_MS);
      }),
    ]);
    clearTimeout(waiting);

    for (const notices of all) {
      for (const notice of notices) {
        if (notice.sequence !== null) {
          last.set(
            notice.channel,
            Math.max(last.get(notice.channel) ?? 0, notice.sequence),
          );
        }
      }
    }

    return last.size === 0
      ? null
      : [...last]
          .map(([channel, sequence]) => `${channel}@${sequence}`)
          .join(',');
  },
};
