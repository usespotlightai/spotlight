import { Injectable } from '@nestjs/common';
import { isIntegrationEventKind } from '@shared-kernel/application/integration-events/integration-event';
import type { DomainEventSubscriber } from '@shared-kernel/application/ports/domain-event-subscriber.port';

// A subscriber hears the kinds it names. It also hears an integration event whose kind starts with one of its prefixes, but never a domain event that way.
const hears = (subscriber: DomainEventSubscriber, kind: string): boolean =>
  subscriber.kinds.includes(kind) ||
  (isIntegrationEventKind(kind) &&
    subscriber.integrationEventPrefixes.some((prefix) =>
      kind.startsWith(prefix),
    ));

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
    return [...this.#named.values()].filter((each) => hears(each, kind));
  }

  named(name: string): DomainEventSubscriber | null {
    return this.#named.get(name) ?? null;
  }
}
