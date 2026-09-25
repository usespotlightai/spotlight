import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export const CHECK_RUNNERS = Symbol('CHECK_RUNNERS');

export interface CheckRunnersPort {
  released(stackId: ChangeStackId): Promise<void>;

  reservationDropped(runner: RunnerId): Promise<void>;
}
