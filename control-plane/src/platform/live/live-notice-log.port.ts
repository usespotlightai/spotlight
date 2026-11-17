import type {
  ChangeNotice,
  SequencedNotice,
} from '@platform/live/change-notices';
import type { LiveChannel } from '@platform/live/live-feed.port';

export const LIVE_NOTICE_LOG = Symbol('LIVE_NOTICE_LOG');

export type LivePositions = ReadonlyMap<LiveChannel, number>;

export interface ChannelLog {
  readonly head: number;
  readonly after: readonly SequencedNotice[];
}

export interface LiveNoticeLogPort {
  append(notices: readonly ChangeNotice[]): Promise<readonly SequencedNotice[]>;

  logs(
    channels: readonly LiveChannel[],
    since: LivePositions,
    limit: number,
  ): Promise<ReadonlyMap<LiveChannel, ChannelLog>>;

  prune(before: Date, limit: number): Promise<number>;
}
