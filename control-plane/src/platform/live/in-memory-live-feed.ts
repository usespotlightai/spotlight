import type {
  LiveChannel,
  LiveFeedPort,
  LiveListener,
  LiveMessage,
} from '@platform/live/live-feed.port';
import { RESYNC } from '@platform/live/live-feed.port';

export class InMemoryLiveFeed implements LiveFeedPort {
  readonly #listeners = new Map<LiveChannel, Set<LiveListener>>();

  publish(channel: LiveChannel, message: LiveMessage): void {
    for (const listener of Array.from(this.#listeners.get(channel) ?? [])) {
      listener(message);
    }
  }

  subscribe(
    channels: readonly LiveChannel[],
    listener: LiveListener,
  ): () => void {
    const distinct = [...new Set(channels)];

    for (const channel of distinct) {
      const listeners = this.#listeners.get(channel) ?? new Set();
      listeners.add(listener);
      this.#listeners.set(channel, listeners);
    }

    let attached = true;

    return () => {
      if (!attached) {
        return;
      }

      attached = false;

      for (const channel of distinct) {
        const listeners = this.#listeners.get(channel);
        listeners?.delete(listener);

        if (listeners?.size === 0) {
          this.#listeners.delete(channel);
        }
      }
    };
  }

  resyncOn(channel: LiveChannel): void {
    for (const listener of Array.from(this.#listeners.get(channel) ?? [])) {
      listener(RESYNC);
    }
  }

  resync(): void {
    const everyone = new Set(
      [...this.#listeners.values()].flatMap((listeners) => [...listeners]),
    );

    for (const listener of everyone) {
      listener(RESYNC);
    }
  }
}
