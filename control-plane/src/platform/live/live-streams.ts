import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type MessageEvent,
} from '@nestjs/common';
import {
  LIVE_FEED,
  type LiveChannel,
  type LiveFeedPort,
} from '@platform/live/live-feed.port';
import { Observable, type Subscriber } from 'rxjs';

export const KEEPALIVE_MS = 20_000;
export const LIFETIME_MS = 10 * 60_000;
export const LIFETIME_SPREAD_MS = 2 * 60_000;
export const HANDOVER_MS = 15_000;
const RETRY_MS = 1_000;

export const LIVE_RANDOM = Symbol('LIVE_RANDOM');

@Injectable()
export class LiveStreams implements BeforeApplicationShutdown {
  readonly #open = new Set<Subscriber<MessageEvent>>();

  constructor(
    @Inject(LIVE_FEED) private readonly feed: LiveFeedPort,
    @Inject(LIVE_RANDOM) private readonly random: () => number,
  ) {}

  open(channels: readonly LiveChannel[]): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      this.#open.add(subscriber);
      subscriber.next({ type: 'ready', data: {}, retry: RETRY_MS });

      const detach = this.feed.subscribe(channels, (message) =>
        subscriber.next({ type: message.type, data: message.data }),
      );
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

  beforeApplicationShutdown(): void {
    for (const subscriber of Array.from(this.#open)) {
      subscriber.complete();
    }
  }
}
