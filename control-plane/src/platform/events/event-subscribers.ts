import { Injectable } from '@nestjs/common';
import {
  isContextPrefix,
  isIntegrationEventKind,
} from '@shared-kernel/application/integration-events/integration-event';
import type { DomainEventSubscriber } from '@shared-kernel/application/ports/domain-event-subscriber.port';
import type { Retry } from '@shared-kernel/domain/value-objects/retry.vo';

// The contexts lane holds the subscribers of the contexts. The sinks lane holds the sinks, which send events out of Spotlight, so a slow receiver does not hold up the subscribers of the contexts.
export type DeliveryLane = 'contexts' | 'sinks';

// What one subscriber hears: the kinds it names, and each integration event kind that starts with one of its prefixes. hears and the outbox's queries both read it, so they match the same kinds.
export interface Hearing {
  readonly name: string;
  readonly kinds: readonly string[];
  readonly prefixes: readonly string[];
}

interface Sink {
  readonly prefixes: readonly string[];
  readonly retry: Retry | null;
}

@Injectable()
export class EventSubscribers {
  readonly #named = new Map<string, DomainEventSubscriber>();
  readonly #sinks = new Map<string, Sink>();

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

  // A sink sends integration events out of Spotlight. It also hears each integration event that a context of the prefixes publishes, but never a domain event; the empty prefix matches every integration event. Its deliveries go in the sinks lane, with its own retry. Only the platform registers a sink: a context hears only the upstream events it names, and the architecture tests refuse this call in a context.
  registerSink(
    subscriber: DomainEventSubscriber,
    {
      prefixes,
      retry = null,
    }: { readonly prefixes: readonly string[]; readonly retry?: Retry | null },
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
    this.#sinks.set(subscriber.name, { prefixes, retry });
  }

  // The subscribers that hear the kind.
  hearing(kind: string): readonly DomainEventSubscriber[] {
    return [...this.#named.keys()]
      .filter((name) => this.hears(name, kind))
      .flatMap((name) => this.named(name) ?? []);
  }

  // The subscriber of the name is registered, and it hears the kind.
  hears(name: string, kind: string): boolean {
    const hearing = this.hearingOf(name);

    return (
      hearing !== null &&
      (hearing.kinds.includes(kind) ||
        (isIntegrationEventKind(kind) &&
          hearing.prefixes.some((prefix) => kind.startsWith(prefix))))
    );
  }

  named(name: string): DomainEventSubscriber | null {
    return this.#named.get(name) ?? null;
  }

  isSink(name: string): boolean {
    return this.#sinks.has(name);
  }

  // The retry of a sink; null for a subscriber that takes the outbox default.
  retry(name: string): Retry | null {
    return this.#sinks.get(name)?.retry ?? null;
  }

  // What each subscriber in the lane hears.
  lane(lane: DeliveryLane): readonly Hearing[] {
    return [...this.#named.keys()]
      .filter((name) => this.isSink(name) === (lane === 'sinks'))
      .flatMap((name) => this.hearingOf(name) ?? []);
  }

  private hearingOf(name: string): Hearing | null {
    const subscriber = this.#named.get(name);

    return subscriber
      ? {
          name,
          kinds: subscriber.kinds,
          prefixes: this.#sinks.get(name)?.prefixes ?? [],
        }
      : null;
  }
}
