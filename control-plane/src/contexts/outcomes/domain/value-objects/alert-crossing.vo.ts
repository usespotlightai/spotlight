import { InvalidAlertError } from '@outcomes/domain/exceptions/invalid-alert.error';
import type { AlertId } from '@outcomes/domain/value-objects/alert-id.vo';
import type {
  AlertReading,
  AlertRule,
} from '@outcomes/domain/value-objects/alert-rule.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

interface CrossingState {
  readonly id: AlertId;
  readonly rule: AlertRule;
  readonly reading: AlertReading;
  readonly runId: RunId;
  readonly taskId: TaskId;
  readonly raisedAt: Date;
  readonly recoveredAt: Date | null;
  readonly clearRuns: number;
  readonly lastSeen: RunId | null;
}

export class AlertCrossing {
  private constructor(
    readonly id: AlertId,
    readonly rule: AlertRule,
    readonly reading: AlertReading,
    readonly runId: RunId,
    readonly taskId: TaskId,
    readonly raisedAt: Date,
    readonly recoveredAt: Date | null,
    readonly clearRuns: number,
    readonly lastSeen: RunId | null,
  ) {}

  static of(
    input: Omit<CrossingState, 'clearRuns' | 'lastSeen'> &
      Partial<Pick<CrossingState, 'clearRuns' | 'lastSeen'>>,
  ): AlertCrossing {
    const clearRuns = input.clearRuns ?? 0;

    if (
      input.recoveredAt &&
      input.recoveredAt.getTime() < input.raisedAt.getTime()
    ) {
      throw new InvalidAlertError('recovers only after it was raised');
    }
    if (input.rule.compares !== (input.reading.baseline !== null)) {
      throw new InvalidAlertError(
        'compares against the runs before only where it watches a rise or fall',
      );
    }
    if (!Number.isInteger(clearRuns) || clearRuns < 0) {
      throw new InvalidAlertError('counts a whole number of clear runs');
    }

    return new AlertCrossing(
      input.id,
      input.rule,
      input.reading,
      input.runId,
      input.taskId,
      input.raisedAt,
      input.recoveredAt,
      clearRuns,
      input.lastSeen ?? null,
    );
  }

  get open(): boolean {
    return this.recoveredAt === null;
  }

  get cooling(): boolean {
    return !this.open && this.clearRuns < this.rule.over * 2;
  }

  rejudged(rule: AlertRule, reading: AlertReading): AlertCrossing {
    return AlertCrossing.of({ ...this.state, rule, reading });
  }

  seenClear(through: RunId, at: Date): AlertCrossing {
    if (!(this.open || this.cooling) || this.lastSeen?.equals(through)) {
      return this;
    }

    const clearRuns = this.clearRuns + 1;

    return AlertCrossing.of({
      ...this.state,
      clearRuns,
      lastSeen: through,
      recoveredAt:
        this.open && clearRuns >= this.rule.over ? at : this.recoveredAt,
    });
  }

  seenCrossed(through: RunId): AlertCrossing {
    if (!this.open || this.clearRuns === 0) {
      return this;
    }

    return AlertCrossing.of({ ...this.state, clearRuns: 0, lastSeen: through });
  }

  reopened(
    rule: AlertRule,
    reading: AlertReading,
    through: RunId,
  ): AlertCrossing {
    if (!this.cooling) {
      throw new InvalidAlertError(
        'reopens only while it is settling after a recovery',
      );
    }

    return AlertCrossing.of({
      ...this.state,
      rule,
      reading,
      recoveredAt: null,
      clearRuns: 0,
      lastSeen: through,
    });
  }

  recovered(at: Date): AlertCrossing {
    return this.open
      ? AlertCrossing.of({
          ...this.state,
          recoveredAt: at,
          clearRuns: Math.max(this.clearRuns, this.rule.over * 2),
        })
      : this;
  }

  private get state(): CrossingState {
    return {
      id: this.id,
      rule: this.rule,
      reading: this.reading,
      runId: this.runId,
      taskId: this.taskId,
      raisedAt: this.raisedAt,
      recoveredAt: this.recoveredAt,
      clearRuns: this.clearRuns,
      lastSeen: this.lastSeen,
    };
  }
}
