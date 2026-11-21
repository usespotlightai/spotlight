import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  type DeliveryLane,
  EventSubscribers,
} from '@platform/events/event-subscribers';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { eventDelivery } from '@platform/persistence/drizzle/schemas/event.schema';
import { Leadership } from '@platform/redis/leadership';
import { ageInSeconds, observeGauges } from '@platform/telemetry/gauges';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { and, count, isNull, lte, sql } from 'drizzle-orm';

const LANES: readonly DeliveryLane[] = ['contexts', 'sinks'];

@Injectable()
export class OutboxGauges implements OnModuleInit, OnModuleDestroy {
  #stop: (() => void) | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly leadership: Leadership,
    private readonly subscribers: EventSubscribers,
  ) {}

  onModuleInit(): void {
    this.#stop = observeGauges(
      {
        'spotlight.outbox.due': {
          description: 'Event deliveries that are due and not delivered',
        },
        'spotlight.outbox.oldest_due_age_seconds': {
          description: 'Age of the oldest event delivery that is due',
        },
        'spotlight.outbox.dead_lettered': {
          description: 'Event deliveries that Spotlight stopped trying',
        },
      },
      () => this.read(),
      () => this.leadership.held(),
    );
  }

  onModuleDestroy(): void {
    this.#stop?.();
  }

  // Each gauge has one value for each delivery lane, so a backlog of a sink does not look like one of the subscribers of the contexts.
  private async read() {
    const now = this.clock.now();
    const due = and(
      isNull(eventDelivery.deadLetteredAt),
      lte(eventDelivery.dueAt, now),
    );
    const rows = await this.db
      .select({
        subscriber: eventDelivery.subscriber,
        due: sql<number>`count(*) filter (where ${due})`.mapWith(Number),
        oldestDue:
          sql<Date | null>`min(${eventDelivery.dueAt}) filter (where ${due})`.mapWith(
            eventDelivery.dueAt,
          ),
        deadLettered: count(eventDelivery.deadLetteredAt),
      })
      .from(eventDelivery)
      .where(isNull(eventDelivery.deliveredAt))
      .groupBy(eventDelivery.subscriber);
    const laneRows = (lane: DeliveryLane) =>
      rows.filter(
        (row) => this.subscribers.isSink(row.subscriber) === (lane === 'sinks'),
      );
    const gauge = (value: (lane: typeof rows) => number) =>
      LANES.map((lane) => ({
        value: value(laneRows(lane)),
        attributes: { 'spotlight.delivery.lane': lane },
      }));
    const oldest = (dates: readonly (Date | null)[]): Date | null =>
      dates.reduce<Date | null>(
        (first, each) => (each && (!first || each < first) ? each : first),
        null,
      );

    return {
      'spotlight.outbox.due': gauge((each) =>
        each.reduce((sum, row) => sum + row.due, 0),
      ),
      'spotlight.outbox.oldest_due_age_seconds': gauge((each) =>
        ageInSeconds(oldest(each.map((row) => row.oldestDue)), now),
      ),
      'spotlight.outbox.dead_lettered': gauge((each) =>
        each.reduce((sum, row) => sum + row.deadLettered, 0),
      ),
    };
  }
}
