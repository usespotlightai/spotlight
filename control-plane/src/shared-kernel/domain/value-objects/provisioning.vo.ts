import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const MOST_FAILURES = 5;

const FIRST_BACKOFF_MS = 5_000;

const LONGEST_BACKOFF_MS = 120_000;

export class Provisioning {
  private constructor(
    readonly failures: number,
    readonly nextAt: Date | null,
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

  failedAt(now: Date): Provisioning {
    const failures = this.failures + 1;
    const backoff = Math.min(
      FIRST_BACKOFF_MS * 2 ** (failures - 1),
      LONGEST_BACKOFF_MS,
    );

    return new Provisioning(failures, new Date(now.getTime() + backoff));
  }

  get exhausted(): boolean {
    return this.failures >= MOST_FAILURES;
  }
}
