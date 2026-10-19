import { Inject, Injectable } from '@nestjs/common';
import { EventCodec } from '@platform/events/event-codec';
import { idsOf } from '@platform/events/event-ids';
import { EventProjections } from '@platform/events/event-projections';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { activeTraceparent } from '@platform/telemetry/trace-context';
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
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

const EVENTS_METRIC = 'spotlight.events';

@Injectable()
export class EventOutbox implements DomainEventDispatcher {
  readonly #codec: EventCodec;
  readonly #recorded = new Set<() => void>();

  constructor(
    private readonly context: DrizzleContext,
    private readonly subscribers: EventSubscribers,
    types: PayloadTypes,
    private readonly mappers: IntegrationEventMappers,
    private readonly projections: EventProjections,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(CAUSATION) private readonly causation: CausationPort,
    @Inject(LOGGER) private readonly logger: LoggerPort,
    @Inject(TELEMETRY) private readonly telemetry: TelemetryPort,
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
    const traceparent = activeTraceparent();
    const recorded: Record<string, unknown>[] = [];

    await this.context.inTransaction(async () => {
      recorded.length = 0;

      for (const event of events) {
        await this.projections.project(event);
      }

      for (const event of events.flatMap((each) => [
        each,
        ...this.mappers.of(each, at),
      ])) {
        const id = this.ids.generate();
        const listening = this.subscribers.listeningTo(event.kind);
        const payload = this.#codec.encode(event);

        await this.context.db.insert(eventOutbox).values({
          id,
          kind: event.kind,
          payload,
          cause,
          traceparent,
          recordedAt: at,
        });
        recorded.push({
          eventId: id,
          kind: event.kind,
          ...idsOf(payload),
          subscribers: listening.length,
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
        const causedBy = chain.started
          ? { root: chain.links[0]?.key, depth: chain.depth }
          : undefined;

        for (const each of recorded) {
          this.logger.info({ ...each, causedBy }, 'Recorded event');
          this.telemetry.count(EVENTS_METRIC, {
            'spotlight.event.kind': String(each.kind),
          });
        }

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
