import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const MAX_WORK_ATTEMPTS = 4;

export const WORK_LEASE_MS = 30 * 60 * 1000;

export const WORK_BACKOFF_MS = 30_000;

export class OwedWork {
  private constructor(
    readonly attempts: number,
    readonly dueAt: Date | null,
  ) {}

  static fresh(): OwedWork {
    return new OwedWork(0, null);
  }

  static rehydrate(input: { attempts: number; dueAt: Date | null }): OwedWork {
    if (!Number.isInteger(input.attempts) || input.attempts < 0) {
      throw new InconsistentStateError(
        'piece of owed work',
        `has been attempted ${input.attempts} times`,
      );
    }

    return new OwedWork(input.attempts, input.dueAt);
  }

  get exhausted(): boolean {
    return this.attempts >= MAX_WORK_ATTEMPTS;
  }

  dueBy(now: Date): boolean {
    return this.dueAt === null || this.dueAt.getTime() <= now.getTime();
  }

  leased(now: Date): OwedWork {
    return new OwedWork(
      this.attempts + 1,
      new Date(now.getTime() + WORK_LEASE_MS),
    );
  }

  waitingUntil(dueAt: Date): OwedWork {
    return new OwedWork(this.attempts, dueAt);
  }

  backedOff(now: Date): OwedWork {
    return new OwedWork(
      this.attempts,
      new Date(
        now.getTime() + WORK_BACKOFF_MS * 2 ** Math.max(0, this.attempts - 1),
      ),
    );
  }
}
