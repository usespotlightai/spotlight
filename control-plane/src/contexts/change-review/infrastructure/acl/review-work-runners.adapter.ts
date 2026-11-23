import type { ReviewWorkRunnersPort } from '@change-review/application/ports/review-work-runners.port';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import type { RunnersPort } from '@runners/application/ports/runners.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class ReviewWorkRunners implements ReviewWorkRunnersPort {
  constructor(
    private readonly runners: RunnersPort,
    private readonly clock: ClockPort,
  ) {}

  checkReleased(stackId: ChangeStackId, at?: Date): Promise<void> {
    return this.runners.workEnded(
      { kind: 'check', id: stackId.value },
      at ?? this.clock.now(),
    );
  }

  diffReleased(diffId: PushDiffId): Promise<void> {
    return this.runners.workEnded(
      { kind: 'diff', id: diffId.value },
      this.clock.now(),
    );
  }

  reservationDropped(runner: RunnerId): Promise<void> {
    return this.runners.reservationDropped(runner, this.clock.now());
  }
}
