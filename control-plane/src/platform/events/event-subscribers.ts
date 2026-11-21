import { Injectable } from '@nestjs/common';
import {
  isContextPrefix,
  isIntegrationEventKind,
} from '@shared-kernel/application/integration-events/integration-event';
import type { DomainEventSubscriber } from '@shared-kernel/application/ports/domain-event-subscriber.port';

@Injectable()
export class EventSubscribers {
  readonly #named = new Map<string, DomainEventSubscriber>();
  readonly #prefixes = new Map<string, readonly string[]>();

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

  // The subscriber also hears each integration event that a context of the prefixes publishes, but never a domain event. The empty prefix matches every integration event. Only the platform registers a subscriber so: a context hears only the upstream events it names, and the architecture tests refuse this call in a context.
  registerByPrefix(
    subscriber: DomainEventSubscriber,
    prefixes: readonly string[],
  ): void {
    const wrong = prefixes.find(
      (each) => each !== '' && !isContextPrefix(each),
    );

    if (wrong !== undefined) {
      throw new Error(
        `${subscriber.name} hears ${wrong}, which is not a context prefix such as identity.`,
      );
    }

    this.register([subscriber]);
    this.#prefixes.set(subscriber.name, prefixes);
  }

  listeningTo(kind: string): readonly DomainEventSubscriber[] {
    return [...this.#named.values()].filter((each) => this.matches(each, kind));
  }

  // The subscriber of the name is registered, and it hears the kind: it names the kind, or one of its prefixes matches the integration event kind.
  hears(name: string, kind: string): boolean {
    const subscriber = this.#named.get(name);

    return subscriber !== undefined && this.matches(subscriber, kind);
  }

  named(name: string): DomainEventSubscriber | null {
    return this.#named.get(name) ?? null;
  }

  names(): readonly string[] {
    return [...this.#named.keys()];
  }

  private matches(subscriber: DomainEventSubscriber, kind: string): boolean {
    return (
      subscriber.kinds.includes(kind) ||
      (isIntegrationEventKind(kind) &&
        (this.#prefixes.get(subscriber.name) ?? []).some((prefix) =>
          kind.startsWith(prefix),
        ))
    );
  }
}
