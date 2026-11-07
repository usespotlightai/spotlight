import type { CheckRunnersPort } from '@change-review/application/ports/check-runners.port';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class CheckRunners implements CheckRunnersPort {
  constructor(
    private readonly runners: RunnersPort,
    private readonly clock: ClockPort,
  ) {}

  released(stackId: ChangeStackId): Promise<void> {
    return this.runners.workEnded(
      { kind: 'check', id: stackId.value },
      this.clock.now(),
    );
  }

  reservationDropped(runner: RunnerId): Promise<void> {
    return this.runners.reservationDropped(runner, this.clock.now());
  }
}
