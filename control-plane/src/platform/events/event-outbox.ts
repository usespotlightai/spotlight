import { Inject, Injectable } from '@nestjs/common';
import { CauseCarrier } from '@platform/events/cause-carrier';
import { EventCodec } from '@platform/events/event-codec';
import { idsOf } from '@platform/events/event-ids';
import { EventProjections } from '@platform/events/event-projections';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import { ChangeNotices, messageOfNotice } from '@platform/live/change-notices';
import { LIVE_FEED, type LiveFeedPort } from '@platform/live/live-feed.port';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { activeTraceparent } from '@platform/telemetry/trace-context';
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
    private readonly notices: ChangeNotices,
    @Inject(LIVE_FEED) private readonly live: LiveFeedPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly causes: CauseCarrier,
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
    const cause = this.causes.current();
    const traceparent = activeTraceparent();
    const recorded: Record<string, unknown>[] = [];

    await this.context.inTransaction(async () => {
      recorded.length = 0;

      for (const event of events) {
        await this.projections.project(event);
      }

      for (const event of events) {
        const published = this.mappers.of(event, at);
        const publishes = published.some(
          (each) => this.subscribers.listeningTo(each.kind).length > 0,
        );

        await this.stored(event, publishes, {
          at,
          cause,
          traceparent,
          recorded,
        });

        for (const each of published) {
          await this.stored(each, false, { at, cause, traceparent, recorded });
        }
      }

      this.context.afterCommit(() => {
        for (const each of recorded) {
          this.logger.info(
            { ...each, caused: cause !== null },
            'Recorded event',
          );
          this.telemetry.count(EVENTS_METRIC, {
            'spotlight.event.kind': String(each.kind),
          });
        }

        this.published(events);

        for (const then of this.#recorded) {
          then();
        }
      });
    });
  }

  private async stored(
    event: DomainEvent,
    publishes: boolean,
    context: {
      readonly at: Date;
      readonly cause: unknown;
      readonly traceparent: string | null;
      readonly recorded: Record<string, unknown>[];
    },
  ): Promise<void> {
    const listening = this.subscribers.listeningTo(event.kind);
    const payload = this.#codec.encode(event);
    const kept = listening.length > 0 || publishes;
    const id = kept ? this.ids.generate() : null;

    context.recorded.push({
      eventId: id,
      kind: event.kind,
      ...idsOf(payload),
      subscribers: listening.length,
    });

    if (!id) {
      return;
    }

    await this.context.db.insert(eventOutbox).values({
      id,
      kind: event.kind,
      payload,
      cause: context.cause,
      traceparent: context.traceparent,
      recordedAt: context.at,
    });

    if (listening.length > 0) {
      await this.context.db.insert(eventDelivery).values(
        listening.map((each) => ({
          eventId: id,
          subscriber: each.name,
          dueAt: context.at,
        })),
      );
    }
  }

  private published(events: readonly DomainEvent[]): void {
    const notices = this.notices.of(events, (name, error) =>
      this.logger.error({ err: error, notice: name }, 'Noticing a change'),
    );

    for (const notice of notices) {
      try {
        this.live.publish(notice.channel, messageOfNotice(notice));
      } catch (error) {
        this.logger.warn(
          { err: error, channel: notice.channel },
          'Publishing a live change',
        );
      }
    }
  }

  decode(payload: unknown): DomainEvent {
    return this.#codec.decode(payload);
  }
}
