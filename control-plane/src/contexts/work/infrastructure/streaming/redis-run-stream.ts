import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type {
  RunEventView,
  RunStreamPort,
} from '@work/application/ports/run-stream.port';
import { InMemoryRunStream } from '@work/infrastructure/streaming/in-memory-run-stream';

const CHANNEL = 'spotlight-run-stream:';

export interface RedisPublisher {
  publish(channel: string, message: string): Promise<unknown>;
}

export interface RedisSubscriber {
  subscribe(channel: string): Promise<unknown>;
  unsubscribe(channel: string): Promise<unknown>;
  on(
    event: 'message',
    listener: (channel: string, message: string) => void,
  ): unknown;
}

export class RedisRunStream implements RunStreamPort {
  private readonly local = new InMemoryRunStream();
  private readonly watched = new Map<string, number>();

  constructor(
    private readonly publisher: RedisPublisher,
    private readonly subscriber: RedisSubscriber,
    private readonly logger: LoggerPort,
  ) {
    subscriber.on('message', (channel, message) => {
      if (channel.startsWith(CHANNEL)) {
        this.local.publish(
          channel.slice(CHANNEL.length),
          JSON.parse(message) as RunEventView[],
        );
      }
    });
  }

  publish(runId: string, events: readonly RunEventView[]): void {
    if (events.length === 0) {
      return;
    }

    this.publisher
      .publish(CHANNEL + runId, JSON.stringify(events))
      .catch((error: unknown) =>
        this.logger.warn({ err: error, runId }, 'Publishing run events'),
      );
  }

  subscribe(
    runId: string,
    listener: (event: RunEventView) => void,
  ): () => void {
    const unsubscribe = this.local.subscribe(runId, listener);
    const watchers = (this.watched.get(runId) ?? 0) + 1;
    this.watched.set(runId, watchers);

    if (watchers === 1) {
      this.subscriber
        .subscribe(CHANNEL + runId)
        .catch((error: unknown) =>
          this.logger.warn({ err: error, runId }, 'Watching run events'),
        );
    }

    let attached = true;

    return () => {
      if (!attached) {
        return;
      }

      attached = false;
      unsubscribe();

      const left = (this.watched.get(runId) ?? 1) - 1;

      if (left > 0) {
        this.watched.set(runId, left);
        return;
      }

      this.watched.delete(runId);
      this.subscriber
        .unsubscribe(CHANNEL + runId)
        .catch((error: unknown) =>
          this.logger.warn({ err: error, runId }, 'Unwatching run events'),
        );
    };
  }
}
