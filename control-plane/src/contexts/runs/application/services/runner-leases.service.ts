import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class RunnerLeases {
  constructor(
    private readonly runners: RunnersPort,
    private readonly clock: ClockPort,
  ) {}

  runLeft(runner: RunnerId, at: Date): Promise<void> {
    return this.runners.release(runner, at);
  }

  // The time the run ended, from its event, so that a late delivery does not move the end of its runner.
  runEnded(runId: RunId, at: Date): Promise<void> {
    return this.runners.workEnded({ kind: 'run', id: runId.value }, at);
  }

  reservationDropped(runnerId: string): Promise<void> {
    return this.runners.reservationDropped(
      RunnerId.of(runnerId),
      this.clock.now(),
    );
  }
}
