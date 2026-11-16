import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { PushDiffId } from '@change-review/domain/value-objects/push-diff-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const REVIEW_WORK_RUNNERS = Symbol('REVIEW_WORK_RUNNERS');

export interface ReviewWorkRunnersPort {
  checkReleased(stackId: ChangeStackId): Promise<void>;

  diffReleased(diffId: PushDiffId): Promise<void>;

  reservationDropped(runner: RunnerId): Promise<void>;
}
