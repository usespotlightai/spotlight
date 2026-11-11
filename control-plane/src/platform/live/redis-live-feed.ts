import type { OnApplicationShutdown } from '@nestjs/common';
import { InMemoryLiveFeed } from '@platform/live/in-memory-live-feed';
import type {
  LiveChannel,
  LiveFeedPort,
  LiveListener,
  LiveMessage,
} from '@platform/live/live-feed.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const PREFIX = 'spotlight-live:';
const EVERYONE = `${PREFIX}resync`;
const RETRY_MS = 1_000;

export interface LivePublisher {
  publish(channel: string, message: string): Promise<unknown>;
}

export interface LiveSubscriber {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(
    event: 'message',
    listener: (channel: string, message: string) => void,
  ): unknown;
  on(event: 'ready', listener: () => void): unknown;
}

const isLiveChannel = (channel: string): channel is LiveChannel =>
  /^(workspace|person):.+$/.test(channel);

const messageOf = (text: string): LiveMessage | null => {
  const parsed: unknown = JSON.parse(text);

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { type?: unknown }).type !== 'string' ||
    typeof (parsed as { data?: unknown }).data !== 'object' ||
    (parsed as { data?: unknown }).data === null
  ) {
    return null;
  }

  return parsed as LiveMessage;
};

export class RedisLiveFeed implements LiveFeedPort, OnApplicationShutdown {
  readonly #local = new InMemoryLiveFeed();
  readonly #watchers = new Map<LiveChannel, number>();
  readonly #retries = new Map<string, ReturnType<typeof setTimeout>>();
  #connected = false;
  #closed = false;
  #owingResync: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly publisher: LivePublisher,
    private readonly subscriber: LiveSubscriber,
    private readonly logger: LoggerPort,
    private readonly retryMs = RETRY_MS,
  ) {
    subscriber.on('message', (prefixed, text) => this.heard(prefixed, text));
    subscriber.on('ready', () => {
      if (this.#connected) {
        this.#local.resync();
      }

      this.#connected = true;
    });
    this.subscribed(
      EVERYONE,
      () => true,
      () => this.#local.resync(),
    );
  }

  onApplicationShutdown(): void {
    this.#closed = true;

    if (this.#owingResync) {
      clearTimeout(this.#owingResync);
      this.#owingResync = null;
    }

    for (const retry of this.#retries.values()) {
      clearTimeout(retry);
    }

    this.#retries.clear();
  }

  publish(channel: LiveChannel, message: LiveMessage): void {
    this.publisher
      .publish(PREFIX + channel, JSON.stringify(message))
      .catch((error: unknown) => {
        this.logger.warn({ err: error, channel }, 'Publishing a live change');
        this.oweResync();
      });
  }

  subscribe(
    channels: readonly LiveChannel[],
    listener: LiveListener,
  ): () => void {
    const distinct = [...new Set(channels)];
    const detach = this.#local.subscribe(distinct, listener);

    for (const channel of distinct) {
      this.watch(channel);
    }

    let attached = true;

    return () => {
      if (!attached) {
        return;
      }

      attached = false;
      detach();

      for (const channel of distinct) {
        this.unwatch(channel);
      }
    };
  }

  private heard(prefixed: string, text: string): void {
    if (prefixed === EVERYONE) {
      this.#local.resync();
      return;
    }

    const channel = prefixed.slice(PREFIX.length);

    if (!prefixed.startsWith(PREFIX) || !isLiveChannel(channel)) {
      return;
    }

    let message: LiveMessage | null;

    try {
      message = messageOf(text);
    } catch (error) {
      this.logger.warn({ err: error, channel }, 'Reading a live change');
      return;
    }

    if (message) {
      this.#local.publish(channel, message);
    }
  }

  private oweResync(): void {
    if (this.#owingResync || this.#closed) {
      return;
    }

    this.#owingResync = setTimeout(() => {
      this.publisher.publish(EVERYONE, '{}').then(
        () => {
          this.#owingResync = null;
        },
        (error: unknown) => {
          this.logger.warn({ err: error }, 'Asking for a live resync');
          this.#owingResync = null;
          this.oweResync();
        },
      );
    }, this.retryMs);
    this.#owingResync.unref?.();
  }

  private watch(channel: LiveChannel): void {
    const watchers = (this.#watchers.get(channel) ?? 0) + 1;
    this.#watchers.set(channel, watchers);

    if (watchers === 1 && !this.#retries.has(PREFIX + channel)) {
      this.subscribed(
        PREFIX + channel,
        () => this.#watchers.has(channel),
        () => this.#local.resyncOn(channel),
      );
    }
  }

  private subscribed(
    prefixed: string,
    wanted: () => boolean,
    recovered: () => void,
    retried = false,
  ): void {
    this.subscriber.subscribe(prefixed).then(
      () => {
        if (retried) {
          recovered();
        }
      },
      (error: unknown) => {
        this.logger.warn(
          { err: error, channel: prefixed },
          'Watching live changes',
        );

        if (this.#closed) {
          return;
        }

        const again = setTimeout(() => {
          this.#retries.delete(prefixed);

          if (wanted() && !this.#closed) {
            this.subscribed(prefixed, wanted, recovered, true);
          }
        }, this.retryMs);
        again.unref?.();
        this.#retries.set(prefixed, again);
      },
    );
  }

  private unwatch(channel: LiveChannel): void {
    const left = (this.#watchers.get(channel) ?? 1) - 1;

    if (left > 0) {
      this.#watchers.set(channel, left);
      return;
    }

    this.#watchers.delete(channel);

    const retry = this.#retries.get(PREFIX + channel);

    if (retry) {
      clearTimeout(retry);
      this.#retries.delete(PREFIX + channel);
    }

    this.subscriber
      .unsubscribe(PREFIX + channel)
      .catch((error: unknown) =>
        this.logger.warn({ err: error, channel }, 'Unwatching live changes'),
      );
  }
}
