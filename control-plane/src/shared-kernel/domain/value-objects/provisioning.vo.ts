import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';

export class Provisioning {
  private constructor(
    readonly failures: number,
    readonly nextAt: Date | null,
    readonly exhausted = false,
  ) {}

  static none(): Provisioning {
    return new Provisioning(0, null);
  }

  static rehydrate(failures: number, nextAt: Date | null): Provisioning {
    if (!Number.isInteger(failures) || failures < 0) {
      throw new InconsistentStateError(
        'provisioned work',
        `has failed to be provisioned an impossible number of times (${failures})`,
      );
    }

    return new Provisioning(failures, nextAt);
  }

  dueAt(now: Date): boolean {
    return this.nextAt === null || this.nextAt.getTime() <= now.getTime();
  }

  failedAt(failure: ProvisionFailure, now: Date): Provisioning {
    const failures = this.failures + 1;
    const next = failure.retry.after(failures, now);

    return new Provisioning(failures, next, next === null);
  }
}
