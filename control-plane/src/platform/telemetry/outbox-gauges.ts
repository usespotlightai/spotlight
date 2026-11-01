import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
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

@Injectable()
export class OutboxGauges implements OnModuleInit, OnModuleDestroy {
  #stop: (() => void) | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly leadership: Leadership,
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

  private async read() {
    const now = this.clock.now();
    const due = and(
      isNull(eventDelivery.deadLetteredAt),
      lte(eventDelivery.dueAt, now),
    );
    const [row] = await this.db
      .select({
        due: sql<number>`count(*) filter (where ${due})`.mapWith(Number),
        oldestDue:
          sql<Date | null>`min(${eventDelivery.dueAt}) filter (where ${due})`.mapWith(
            eventDelivery.dueAt,
          ),
        deadLettered: count(eventDelivery.deadLetteredAt),
      })
      .from(eventDelivery)
      .where(isNull(eventDelivery.deliveredAt));

    return {
      'spotlight.outbox.due': [{ value: row?.due ?? 0 }],
      'spotlight.outbox.oldest_due_age_seconds': [
        { value: ageInSeconds(row?.oldestDue ?? null, now) },
      ],
      'spotlight.outbox.dead_lettered': [{ value: row?.deadLettered ?? 0 }],
    };
  }
}
