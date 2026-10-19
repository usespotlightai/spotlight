import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { ageInSeconds, observeGauges } from '@platform/telemetry/gauges';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, count, eq, inArray, isNull, lte, min, or } from 'drizzle-orm';

const OPEN_STATES = ['queued', 'claimed', 'waiting', 'suspended'] as const;

@Injectable()
export class RunGauges implements OnModuleInit, OnModuleDestroy {
  #stop: (() => void) | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(CLOCK) private readonly clock: ClockPort,
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
    );
  }

  onModuleDestroy(): void {
    this.#stop?.();
  }

  private async read() {
    const now = this.clock.now();
    const [byState, [oldest]] = await Promise.all([
      this.db
        .select({ state: run.state, runs: count() })
        .from(run)
        .where(inArray(run.state, [...OPEN_STATES]))
        .groupBy(run.state),
      this.db
        .select({ queuedAt: min(run.queuedAt) })
        .from(run)
        .where(
          and(
            eq(run.state, 'queued'),
            or(isNull(run.claimableFrom), lte(run.claimableFrom, now)),
          ),
        ),
    ]);
    const counted = new Map(byState.map((each) => [each.state, each.runs]));

    return {
      'spotlight.runs': OPEN_STATES.map((state) => ({
        value: counted.get(state) ?? 0,
        attributes: { 'spotlight.run.state': state },
      })),
      'spotlight.runs.oldest_queued_age_seconds': [
        { value: ageInSeconds(oldest?.queuedAt ?? null, now) },
      ],
    };
  }
}
