import type { SequencedNotice } from '@platform/live/change-notices';
import { isLiveChannel, type LiveChannel } from '@platform/live/live-feed.port';
import type {
  ChannelLog,
  LivePositions,
} from '@platform/live/live-notice-log.port';

export const REPLAY_LIMIT = 1_000;

export interface LiveReplay {
  readonly notices: readonly SequencedNotice[];
  readonly heads: Readonly<Record<LiveChannel, number>>;
  readonly complete: boolean;
}

export const replayOf = (
  channels: readonly LiveChannel[],
  since: LivePositions,
  logs: ReadonlyMap<LiveChannel, ChannelLog>,
): LiveReplay => {
  const notices: SequencedNotice[] = [];
  const heads: Record<LiveChannel, number> = {};
  let complete = true;

  for (const channel of channels) {
    const log = logs.get(channel) ?? { head: 0, after: [] };
    const from = since.get(channel);

    if (from === undefined) {
      heads[channel] = log.head;
      complete = false;
      continue;
    }

    const missed = log.head - from;

    if (missed < 0 || missed > REPLAY_LIMIT || log.after.length !== missed) {
      heads[channel] = log.head;
      complete = false;
      continue;
    }

    notices.push(...log.after);
    heads[channel] = Math.max(from, log.head);
  }

  return { notices, heads, complete };
};

export const sinceOf = (
  values: readonly string[],
  channels: readonly LiveChannel[],
): LivePositions => {
  const watched = new Set<string>(channels);
  const positions = new Map<LiveChannel, number>();

  for (const value of values.flatMap((each) => each.split(','))) {
    const at = value.lastIndexOf('@');
    const channel = value.slice(0, at).trim();
    const sequence = Number(value.slice(at + 1));

    if (
      at > 0 &&
      isLiveChannel(channel) &&
      watched.has(channel) &&
      Number.isSafeInteger(sequence) &&
      sequence >= 0
    ) {
      positions.set(channel, sequence);
    }
  }

  return positions;
};
