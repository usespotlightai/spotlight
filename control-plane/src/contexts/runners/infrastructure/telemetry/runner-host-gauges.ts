import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { observeGauges } from '@platform/telemetry/gauges';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { runnerHost } from '@runners/infrastructure/persistence/drizzle/schemas/runner.schema';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { count, gt } from 'drizzle-orm';

@Injectable()
export class RunnerHostGauges implements OnModuleInit, OnModuleDestroy {
  #stop: (() => void) | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  onModuleInit(): void {
    this.#stop = observeGauges(
      {
        'spotlight.runner_hosts.online': {
          description: 'Runner hosts that sent a heartbeat recently',
        },
      },
      () => this.read(),
    );
  }

  onModuleDestroy(): void {
    this.#stop?.();
  }

  private async read() {
    const [row] = await this.db
      .select({ hosts: count() })
      .from(runnerHost)
      .where(
        gt(
          runnerHost.lastHeartbeatAt,
          RunnerHost.onlineCutoff(this.clock.now()),
        ),
      );

    return { 'spotlight.runner_hosts.online': [{ value: row?.hosts ?? 0 }] };
  }
}
