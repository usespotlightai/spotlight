import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CheckEndingsPort } from '@work/application/ports/check-endings.port';

export class RunnerHolds implements CheckEndingsPort {
  constructor(
    private readonly runners: RunnersPort,
    private readonly clock: ClockPort,
  ) {}

  runLeft(runner: RunnerId, at: Date): Promise<void> {
    return this.runners.letGo(runner, at);
  }

  runEnded(runId: RunId): Promise<void> {
    return this.runners.workEnded(
      { kind: 'run', id: runId.value },
      this.clock.now(),
    );
  }

  reservationDropped(runnerId: string): Promise<void> {
    return this.runners.reservationDropped(
      RunnerId.of(runnerId),
      this.clock.now(),
    );
  }

  checkEnded(stackId: string): Promise<void> {
    return this.runners.workEnded(
      { kind: 'check', id: stackId },
      this.clock.now(),
    );
  }
}
