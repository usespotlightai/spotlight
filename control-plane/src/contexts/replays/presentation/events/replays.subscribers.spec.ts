import {
  type ReplaysReactions,
  replaysSubscribers,
} from '@replays/presentation/events/replays.subscribers';
import { describe, expect, it } from 'vitest';

describe('replaysSubscribers', () => {
  it('commits the stop of each superseded replay on its own, outside the delivery transaction', () => {
    const stopping = replaysSubscribers({} as ReplaysReactions).find(
      (each) => each.name === 'replays.stop-superseded-checks',
    );

    expect(stopping?.callsOut).toBe(true);
  });
});
