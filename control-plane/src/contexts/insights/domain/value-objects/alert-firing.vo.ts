import { InvalidAlertError } from '@insights/domain/exceptions/invalid-alert.error';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import type {
  AlertReading,
  AlertRule,
} from '@insights/domain/value-objects/alert-rule.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

interface FiringState {
  readonly id: AlertId;
  readonly rule: AlertRule;
  readonly reading: AlertReading;
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly firedAt: Date;
  readonly resolvedAt: Date | null;
  readonly clearRuns: number;
  readonly lastSeen: RunId | null;
}

export class AlertFiring {
  private constructor(
    readonly id: AlertId,
    readonly rule: AlertRule,
    readonly reading: AlertReading,
    readonly runId: RunId,
    readonly taskId: TaskId,
    readonly firedAt: Date,
    readonly resolvedAt: Date | null,
    readonly clearRuns: number,
    readonly lastSeen: RunId | null,
  ) {}

  static of(
    input: Omit<FiringState, 'clearRuns' | 'lastSeen'> &
      Partial<Pick<FiringState, 'clearRuns' | 'lastSeen'>>,
  ): AlertFiring {
    const clearRuns = input.clearRuns ?? 0;

    if (
      input.resolvedAt &&
      input.resolvedAt.getTime() < input.firedAt.getTime()
    ) {
      throw new InvalidAlertError('can resolve only after it fired');
    }
    if (input.rule.compares !== (input.reading.baseline !== null)) {
      throw new InvalidAlertError(
        'can compare with earlier runs only when watching a rise or fall',
      );
    }
    if (!Number.isInteger(clearRuns) || clearRuns < 0) {
      throw new InvalidAlertError('clear runs must be a whole number');
    }

    return new AlertFiring(
      input.id,
      input.rule,
      input.reading,
      input.runId,
      input.taskId,
      input.firedAt,
      input.resolvedAt,
      clearRuns,
      input.lastSeen ?? null,
    );
  }

  get open(): boolean {
    return this.resolvedAt === null;
  }

  get cooling(): boolean {
    return !this.open && this.clearRuns < this.rule.over * 2;
  }

  rejudged(rule: AlertRule, reading: AlertReading): AlertFiring {
    return AlertFiring.of({ ...this.state, rule, reading });
  }

  seenClear(through: RunId, at: Date): AlertFiring {
    if (!(this.open || this.cooling) || this.lastSeen?.equals(through)) {
      return this;
    }

    const clearRuns = this.clearRuns + 1;

    return AlertFiring.of({
      ...this.state,
      clearRuns,
      lastSeen: through,
      resolvedAt:
        this.open && clearRuns >= this.rule.over ? at : this.resolvedAt,
    });
  }

  seenCrossed(through: RunId): AlertFiring {
    if (!this.open || this.clearRuns === 0) {
      return this;
    }

    return AlertFiring.of({ ...this.state, clearRuns: 0, lastSeen: through });
  }

  reopened(
    rule: AlertRule,
    reading: AlertReading,
    through: RunId,
  ): AlertFiring {
    if (!this.cooling) {
      throw new InvalidAlertError(
        'can reopen only in the cooldown after it resolved',
      );
    }

    return AlertFiring.of({
      ...this.state,
      rule,
      reading,
      resolvedAt: null,
      clearRuns: 0,
      lastSeen: through,
    });
  }

  resolved(at: Date): AlertFiring {
    return this.open
      ? AlertFiring.of({
          ...this.state,
          resolvedAt: at,
          clearRuns: Math.max(this.clearRuns, this.rule.over * 2),
        })
      : this;
  }

  private get state(): FiringState {
    return {
      id: this.id,
      rule: this.rule,
      reading: this.reading,
      runId: this.runId,
      taskId: this.taskId,
      firedAt: this.firedAt,
      resolvedAt: this.resolvedAt,
      clearRuns: this.clearRuns,
      lastSeen: this.lastSeen,
    };
  }
}
