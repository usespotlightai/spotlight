import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const msBetween = (from: Date, to: Date): number =>
  Math.max(0, to.getTime() - from.getTime());

const isDuration = (ms: number): boolean => Number.isInteger(ms) && ms >= 0;

export class TimeSpent {
  private constructor(
    readonly queuedMs: number,
    readonly runningMs: number,
    readonly firstStartedAt: Date | null,
  ) {}

  static none(): TimeSpent {
    return new TimeSpent(0, 0, null);
  }

  static rehydrate(input: {
    queuedMs: number;
    runningMs: number;
    firstStartedAt: Date | null;
  }): TimeSpent {
    if (!isDuration(input.queuedMs) || !isDuration(input.runningMs)) {
      throw new InconsistentStateError(
        'run',
        `spent ${input.queuedMs} ms queued and ${input.runningMs} ms running`,
      );
    }
    if (input.runningMs > 0 && input.firstStartedAt === null) {
      throw new InconsistentStateError('run', 'ran without ever starting');
    }

    return new TimeSpent(input.queuedMs, input.runningMs, input.firstStartedAt);
  }

  startedAfter(queuedAt: Date, now: Date): TimeSpent {
    return new TimeSpent(
      this.queuedMs + msBetween(queuedAt, now),
      this.runningMs,
      this.firstStartedAt ?? now,
    );
  }

  queuedBetween(from: Date, to: Date): TimeSpent {
    return new TimeSpent(
      this.queuedMs + msBetween(from, to),
      this.runningMs,
      this.firstStartedAt,
    );
  }

  ranBetween(from: Date, to: Date): TimeSpent {
    return new TimeSpent(
      this.queuedMs,
      this.runningMs + msBetween(from, to),
      this.firstStartedAt ?? from,
    );
  }
}
