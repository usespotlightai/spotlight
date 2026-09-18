import { Inject, Injectable } from '@nestjs/common';
import { EventCodec } from '@platform/events/event-codec';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import type { DomainEventDispatcher } from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

@Injectable()
export class EventOutbox implements DomainEventDispatcher {
  readonly #codec: EventCodec;
  readonly #recorded = new Set<() => void>();

  constructor(
    private readonly context: DrizzleContext,
    private readonly subscribers: EventSubscribers,
    types: EventTypes,
    private readonly publications: EventPublications,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {
    this.#codec = new EventCodec(types);
  }

  onRecorded(then: () => void): () => void {
    this.#recorded.add(then);
    return () => this.#recorded.delete(then);
  }

  dispatch(events: readonly DomainEvent[]): Promise<void> {
    return this.record(events);
  }

  async record(events: readonly DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    await this.context.run(async () => {
      for (const event of events.flatMap((each) => [
        each,
        ...this.publications.of(each),
      ])) {
        const id = this.ids.generate();
        const listening = this.subscribers.listeningTo(event.kind);

        await this.context.db.insert(eventOutbox).values({
          id,
          kind: event.kind,
          payload: this.#codec.encode(event),
        });

        if (listening.length > 0) {
          await this.context.db.insert(eventDelivery).values(
            listening.map((each) => ({
              eventId: id,
              subscriber: each.name,
            })),
          );
        }
      }

      this.context.afterCommit(() => {
        for (const then of this.#recorded) {
          then();
        }
      });
    });
  }

  decode(payload: unknown): DomainEvent {
    return this.#codec.decode(payload);
  }
}
