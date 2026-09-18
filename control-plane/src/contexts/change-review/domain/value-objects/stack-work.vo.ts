import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const MOST_WORK_ATTEMPTS = 4;

export const WORK_LEASE_MS = 30 * 60 * 1000;

export const WORK_BACKOFF_MS = 30_000;

export class StackWork {
  private constructor(
    readonly attempts: number,
    readonly dueAt: Date | null,
  ) {}

  static fresh(): StackWork {
    return new StackWork(0, null);
  }

  static rehydrate(input: { attempts: number; dueAt: Date | null }): StackWork {
    if (!Number.isInteger(input.attempts) || input.attempts < 0) {
      throw new InconsistentStateError(
        'change stack work',
        `has been attempted ${input.attempts} times`,
      );
    }

    return new StackWork(input.attempts, input.dueAt);
  }

  get exhausted(): boolean {
    return this.attempts >= MOST_WORK_ATTEMPTS;
  }

  dueBy(now: Date): boolean {
    return this.dueAt === null || this.dueAt.getTime() <= now.getTime();
  }

  leased(now: Date): StackWork {
    return new StackWork(
      this.attempts + 1,
      new Date(now.getTime() + WORK_LEASE_MS),
    );
  }

  backedOff(now: Date): StackWork {
    return new StackWork(
      this.attempts,
      new Date(
        now.getTime() + WORK_BACKOFF_MS * 2 ** Math.max(0, this.attempts - 1),
      ),
    );
  }
}
