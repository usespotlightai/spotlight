import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';

export class Provisioning {
  private constructor(
    readonly attempts: number,
    readonly nextAttemptAt: Date | null,
    readonly exhausted = false,
  ) {}

  static none(): Provisioning {
    return new Provisioning(0, null);
  }

  static rehydrate(attempts: number, nextAttemptAt: Date | null): Provisioning {
    if (!Number.isInteger(attempts) || attempts < 0) {
      throw new InconsistentStateError(
        'provisioned work',
        `has an impossible number of provision attempts (${attempts})`,
      );
    }

    return new Provisioning(attempts, nextAttemptAt);
  }

  isDue(now: Date): boolean {
    return (
      this.nextAttemptAt === null ||
      this.nextAttemptAt.getTime() <= now.getTime()
    );
  }

  recordFailure(failure: ProvisionFailure, now: Date): Provisioning {
    const attempts = this.attempts + 1;
    const next = failure.retry.nextAttemptAt(attempts, now);

    return new Provisioning(attempts, next, next === null);
  }
}
