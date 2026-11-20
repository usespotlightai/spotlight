import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type MessageEvent,
} from '@nestjs/common';
import { messageOfNotice, positionOf } from '@platform/live/change-notices';
import {
  LIVE_FEED,
  type LiveChannel,
  type LiveFeedPort,
  type LiveMessage,
} from '@platform/live/live-feed.port';
import {
  LIVE_NOTICE_LOG,
  type LiveNoticeLogPort,
  type LivePositions,
} from '@platform/live/live-notice-log.port';
import {
  type LiveReplay,
  REPLAY_LIMIT,
  replayOf,
} from '@platform/live/live-replay';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { Observable, type Subscriber } from 'rxjs';

export const KEEPALIVE_MS = 20_000;
export const LIFETIME_MS = 10 * 60_000;
export const LIFETIME_SPREAD_MS = 2 * 60_000;
export const HANDOVER_MS = 15_000;
const RETRY_MS = 1_000;
const WATCH_WAIT_MS = 3_000;

export const LIVE_RANDOM = Symbol('LIVE_RANDOM');

const NOTHING_REPLAYED: LiveReplay = {
  notices: [],
  heads: {},
  complete: false,
};

@Injectable()
export class LiveStreams implements BeforeApplicationShutdown {
  readonly #open = new Set<Subscriber<MessageEvent>>();

  constructor(
    @Inject(LIVE_FEED) private readonly feed: LiveFeedPort,
    @Inject(LIVE_NOTICE_LOG) private readonly log: LiveNoticeLogPort,
    @Inject(LIVE_RANDOM) private readonly random: () => number,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  open(
    channels: readonly LiveChannel[],
    since: LivePositions = new Map(),
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      this.#open.add(subscriber);

      const sent = new Map<string, number>(since);
      let held: LiveMessage[] | null = [];

      const passed = (message: LiveMessage) => {
        const position = positionOf(message);

        if (
          position &&
          position.sequence <= (sent.get(position.channel) ?? 0)
        ) {
          return;
        }

        subscriber.next({ type: message.type, data: message.data });
      };

      const detach = this.feed.subscribe(channels, (message) => {
        if (held) {
          held.push(message);
        } else {
          passed(message);
        }
      });

      void this.watched(channels)
        .then(() => this.log.logs(channels, since, REPLAY_LIMIT))
        .then((logs) => replayOf(channels, since, logs))
        .catch((error: unknown) => {
          this.logger.warn({ err: error }, 'Replaying live notices');
          return NOTHING_REPLAYED;
        })
        .then((replay) => {
          if (subscriber.closed) {
            return;
          }

          for (const [channel, head] of Object.entries(replay.heads)) {
            if ((sent.get(channel) ?? 0) > head) {
              sent.set(channel, head);
            }
          }

          for (const notice of replay.notices) {
            subscriber.next(messageOfNotice(notice));
            sent.set(
              notice.channel,
              Math.max(sent.get(notice.channel) ?? 0, notice.sequence ?? 0),
            );
          }

          subscriber.next({
            type: 'ready',
            data: { complete: replay.complete, heads: replay.heads },
            retry: RETRY_MS,
          });

          const waiting = held ?? [];
          held = null;

          for (const message of waiting) {
            passed(message);
          }
        });

      const keepalive = setInterval(
        () => subscriber.next({ type: 'keepalive', data: {} }),
        KEEPALIVE_MS,
      );
      let ending: ReturnType<typeof setTimeout> | undefined;
      const lifetime = setTimeout(
        () => {
          subscriber.next({ type: 'reopen', data: {} });
          ending = setTimeout(() => subscriber.complete(), HANDOVER_MS);
          ending.unref();
        },
        LIFETIME_MS + Math.floor(this.random() * LIFETIME_SPREAD_MS),
      );

      keepalive.unref();
      lifetime.unref();

      return () => {
        detach();
        clearInterval(keepalive);
        clearTimeout(lifetime);
        clearTimeout(ending);
        this.#open.delete(subscriber);
      };
    });
  }

  private async watched(channels: readonly LiveChannel[]): Promise<void> {
    let waiting: ReturnType<typeof setTimeout> | undefined;

    await Promise.race([
      this.feed.watched(channels),
      new Promise<void>((resolve) => {
        waiting = setTimeout(resolve, WATCH_WAIT_MS);
      }),
    ]);
    clearTimeout(waiting);
  }

  beforeApplicationShutdown(): void {
    for (const subscriber of Array.from(this.#open)) {
      subscriber.complete();
    }
  }
}
