import type { CheckRunnersPort } from '@change-review/application/ports/check-runners.port';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { CheckEndingsPort } from '@work/application/ports/check-endings.port';

export class CheckRunners implements CheckRunnersPort {
  constructor(private readonly endings: CheckEndingsPort) {}

  released(stackId: ChangeStackId): Promise<void> {
    return this.endings.checkEnded(stackId.value);
  }

  reservationDropped(runner: RunnerId): Promise<void> {
    return this.endings.reservationDropped(runner.value);
  }
}
