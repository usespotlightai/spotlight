import type { PoolRunnersPort } from '@runners/application/ports/pool-runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CheckEndingsPort } from '@work/application/ports/check-endings.port';

export class EndPoolRunners implements CheckEndingsPort {
  constructor(
    private readonly pooled: PoolRunnersPort,
    private readonly clock: ClockPort,
  ) {}

  runEnded(runId: RunId): Promise<void> {
    return this.pooled.workEnded(
      { kind: 'run', id: runId.value },
      this.clock.now(),
    );
  }

  reservationDropped(runnerId: string): Promise<void> {
    return this.pooled.letGo(RunnerId.of(runnerId), this.clock.now());
  }

  checkEnded(stackId: string): Promise<void> {
    return this.pooled.workEnded(
      { kind: 'check', id: stackId },
      this.clock.now(),
    );
  }
}
