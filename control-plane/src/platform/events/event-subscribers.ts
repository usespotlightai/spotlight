import { Injectable } from '@nestjs/common';
import type { DomainEventSubscriber } from '@shared-kernel/application/ports/domain-event-subscriber.port';

@Injectable()
export class EventSubscribers {
  readonly #named = new Map<string, DomainEventSubscriber>();

  register(subscribers: readonly DomainEventSubscriber[]): void {
    for (const subscriber of subscribers) {
      if (this.#named.has(subscriber.name)) {
        throw new Error(
          `Two event subscribers are both called ${subscriber.name}`,
        );
      }

      this.#named.set(subscriber.name, subscriber);
    }
  }

  listeningTo(kind: string): readonly DomainEventSubscriber[] {
    return [...this.#named.values()].filter((each) =>
      each.kinds.includes(kind),
    );
  }

  named(name: string): DomainEventSubscriber | null {
    return this.#named.get(name) ?? null;
  }
}
