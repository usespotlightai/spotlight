import { Inject, Injectable } from '@nestjs/common';
import { EventCodec } from '@platform/events/event-codec';
import { EventProjections } from '@platform/events/event-projections';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import {
  CAUSATION,
  type CausationPort,
} from '@shared-kernel/application/ports/causation.port';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
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
    private readonly projections: EventProjections,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(CAUSATION) private readonly causation: CausationPort,
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

    const at = this.clock.now();
    const chain = this.causation.current();
    const cause = chain.started ? chain.stored : null;

    await this.context.run(async () => {
      for (const event of events) {
        await this.projections.project(event);
      }

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
          cause,
          recordedAt: at,
        });

        if (listening.length > 0) {
          await this.context.db.insert(eventDelivery).values(
            listening.map((each) => ({
              eventId: id,
              subscriber: each.name,
              dueAt: at,
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
