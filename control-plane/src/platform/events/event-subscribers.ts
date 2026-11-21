import { Injectable } from '@nestjs/common';
import { isIntegrationEventKind } from '@shared-kernel/application/integration-events/integration-event';
import type { DomainEventSubscriber } from '@shared-kernel/application/ports/domain-event-subscriber.port';

// A context prefix, as in identity., or the empty prefix, which matches every integration event.
const CONTEXT_PREFIX = /^([a-z][a-z-]*\.)?$/;

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

  // The subscriber also hears each integration event that a context of the prefixes publishes, but never a domain event. Only the platform registers a subscriber so: a context hears only the upstream events it names.
  registerByPrefix(
    subscriber: DomainEventSubscriber,
    prefixes: readonly string[],
  ): void {
    const wrong = prefixes.find((each) => !CONTEXT_PREFIX.test(each));

    if (wrong !== undefined) {
      throw new Error(
        `${subscriber.name} hears ${wrong}, which is not a context prefix such as identity.`,
      );
    }

    this.register([subscriber]);
    this.#prefixes.set(subscriber.name, prefixes);
  }

  listeningTo(kind: string): readonly DomainEventSubscriber[] {
    return [...this.#named.values()].filter((each) => this.hears(each, kind));
  }

  named(name: string): DomainEventSubscriber | null {
    return this.#named.get(name) ?? null;
  }

  names(): readonly string[] {
    return [...this.#named.keys()];
  }

  private hears(subscriber: DomainEventSubscriber, kind: string): boolean {
    return (
      subscriber.kinds.includes(kind) ||
      (isIntegrationEventKind(kind) &&
        (this.#prefixes.get(subscriber.name) ?? []).some((prefix) =>
          kind.startsWith(prefix),
        ))
    );
  }
}
