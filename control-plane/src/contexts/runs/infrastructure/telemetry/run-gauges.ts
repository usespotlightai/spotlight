import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { Leadership } from '@platform/redis/leadership';
import { ageInSeconds, observeGauges } from '@platform/telemetry/gauges';
import { OPEN_RUN_STATES } from '@runs/domain/value-objects/run-state';
import { claimableAt } from '@runs/domain/value-objects/run-waiting';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { count, eq, inArray } from 'drizzle-orm';

@Injectable()
export class RunGauges implements OnModuleInit, OnModuleDestroy {
  #stop: (() => void) | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(CLOCK) private readonly clock: ClockPort,
    private readonly leadership: Leadership,
  ) {}

  onModuleInit(): void {
    this.#stop = observeGauges(
      {
        'spotlight.runs': {
          description: 'Runs that have not ended, by state',
        },
        'spotlight.runs.oldest_queued_age_seconds': {
          description: 'Age of the oldest run that a runner can claim now',
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
    const [byState, queued] = await Promise.all([
      this.db
        .select({ state: run.state, runs: count() })
        .from(run)
        .where(inArray(run.state, [...OPEN_RUN_STATES]))
        .groupBy(run.state),
      this.db
        .select({
          state: run.state,
          queuedAt: run.queuedAt,
          claimableFrom: run.claimableFrom,
          reservedUntil: run.reservedUntil,
        })
        .from(run)
        .where(eq(run.state, 'queued')),
    ]);
    const oldest = queued
      .filter((each) => claimableAt(each, now))
      .reduce<Date | null>(
        (first, each) =>
          first === null || each.queuedAt < first ? each.queuedAt : first,
        null,
      );
    const counted = new Map(byState.map((each) => [each.state, each.runs]));

    return {
      'spotlight.runs': OPEN_RUN_STATES.map((state) => ({
        value: counted.get(state) ?? 0,
        attributes: { 'spotlight.run.state': state },
      })),
      'spotlight.runs.oldest_queued_age_seconds': [
        { value: ageInSeconds(oldest, now) },
      ],
    };
  }
}
