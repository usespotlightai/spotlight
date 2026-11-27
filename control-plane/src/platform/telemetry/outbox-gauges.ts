import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  DELIVERY_LANES,
  EventSubscribers,
} from '@platform/events/event-subscribers';
import { heardDeliveries } from '@platform/events/heard-deliveries';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  eventDelivery,
  eventOutbox,
} from '@platform/persistence/drizzle/schemas/event.schema';
import { Leadership } from '@platform/redis/leadership';
import {
  ageInSeconds,
  type Observation,
  observeGauges,
} from '@platform/telemetry/gauges';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import type { MetricAttributes } from '@shared-kernel/application/ports/telemetry.port';
import { firstOf } from '@shared-kernel/domain/item-at';
import {
  and,
  count,
  eq,
  isNull,
  lte,
  not,
  or,
  type SQL,
  sql,
} from 'drizzle-orm';

type OutboxGauge =
  | 'spotlight.outbox.due'
  | 'spotlight.outbox.oldest_due_age_seconds'
  | 'spotlight.outbox.dead_lettered';

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

  // Each gauge has one value for each delivery lane, of the deliveries that a subscriber of the lane hears, and one marked unheard for those that no subscriber of this instance hears, which wait for retention.
  async read(): Promise<Record<OutboxGauge, readonly Observation[]>> {
    const lanes = DELIVERY_LANES.map((lane) => ({
      attributes: {
        'spotlight.delivery.lane': lane,
      } satisfies MetricAttributes,
      heard: heardDeliveries(this.subscribers.lane(lane)),
    }));
    const groups = [
      ...lanes,
      {
        attributes: {
          'spotlight.delivery.unheard': 'true',
        } satisfies MetricAttributes,
        heard: not(or(...lanes.map((each) => each.heard)) ?? sql`false`),
      },
    ];
    const now = this.clock.now();
    const rows = await Promise.all(
      groups.map(async (group) => ({
        attributes: group.attributes,
        ...(await this.readGroup(group.heard, now)),
      })),
    );
    const gauge = (
      value: (row: (typeof rows)[number]) => number,
    ): readonly Observation[] =>
      rows.map((row) => ({ value: value(row), attributes: row.attributes }));

    return {
      'spotlight.outbox.due': gauge((row) => row.due),
      'spotlight.outbox.oldest_due_age_seconds': gauge((row) =>
        ageInSeconds(row.oldestDue, now),
      ),
      'spotlight.outbox.dead_lettered': gauge((row) => row.deadLettered),
    };
  }

  private async readGroup(heard: SQL, now: Date) {
    const due = and(
      isNull(eventDelivery.deadLetteredAt),
      lte(eventDelivery.dueAt, now),
    );
    const row = firstOf(
      await this.db
        .select({
          due: sql<number>`count(*) filter (where ${due})`.mapWith(Number),
          oldestDue:
            sql<Date | null>`min(${eventDelivery.dueAt}) filter (where ${due})`.mapWith(
              eventDelivery.dueAt,
            ),
          deadLettered: count(eventDelivery.deadLetteredAt),
        })
        .from(eventDelivery)
        .innerJoin(eventOutbox, eq(eventOutbox.id, eventDelivery.eventId))
        .where(and(isNull(eventDelivery.deliveredAt), heard)),
    );

    return {
      due: row?.due ?? 0,
      oldestDue: row?.oldestDue ?? null,
      deadLettered: row?.deadLettered ?? 0,
    };
  }
}
