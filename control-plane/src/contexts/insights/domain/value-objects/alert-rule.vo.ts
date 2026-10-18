import { InvalidAlertError } from '@insights/domain/exceptions/invalid-alert.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const ALERT_MEASURES = [
  'sent_back_rate',
  'accepted_rate',
  'checks_failed_rate',
  'failed_rate',
  'merged_rate',
  'cost_per_run',
] as const;

export type AlertMeasure = (typeof ALERT_MEASURES)[number];

export const ALERT_CONDITIONS = [
  'risesBy',
  'fallsBy',
  'above',
  'below',
] as const;

export type AlertCondition = (typeof ALERT_CONDITIONS)[number];

const MOVES: ReadonlySet<AlertCondition> = new Set(['risesBy', 'fallsBy']);

const LEEWAY = 1e-9;

export interface AlertReading {
  readonly value: number;
  readonly baseline: number | null;
}

export interface FinalReading extends AlertReading {
  readonly runId: RunId;
  readonly taskId: TaskId;
}

const isMeasure = (raw: string): raw is AlertMeasure =>
  ALERT_MEASURES.some((each) => each === raw);

export class AlertRule {
  private constructor(
    readonly measure: AlertMeasure,
    readonly condition: AlertCondition,
    readonly threshold: number,
    readonly over: number,
  ) {}

  static of(input: {
    measure: string;
    risesBy?: number | null;
    fallsBy?: number | null;
    above?: number | null;
    below?: number | null;
    over: number;
  }): AlertRule {
    const set = ALERT_CONDITIONS.filter(
      (each) => (input[each] ?? null) !== null,
    );

    if (!isMeasure(input.measure)) {
      throw new InvalidAlertError(
        `measure must be one of ${ALERT_MEASURES.join(', ')}`,
      );
    }
    if (set.length !== 1) {
      throw new InvalidAlertError(
        `must set exactly one of ${ALERT_CONDITIONS.join(', ')}`,
      );
    }

    const [condition] = set as [AlertCondition];
    const threshold = input[condition] as number;

    if (!Number.isFinite(threshold) || threshold < 0) {
      throw new InvalidAlertError('threshold must be 0 or more');
    }
    if (!Number.isInteger(input.over) || input.over < 1) {
      throw new InvalidAlertError(
        'run count must be a whole number of at least 1',
      );
    }

    return new AlertRule(input.measure, condition, threshold, input.over);
  }

  get key(): string {
    return `${this.measure}:${this.condition}`;
  }

  get compares(): boolean {
    return MOVES.has(this.condition);
  }

  get runsNeeded(): number {
    return this.compares ? this.over * 2 : this.over;
  }

  crossedBy(reading: AlertReading): boolean {
    const { value, baseline } = reading;

    switch (this.condition) {
      case 'risesBy':
        return baseline !== null && value - baseline >= this.threshold - LEEWAY;
      case 'fallsBy':
        return baseline !== null && baseline - value >= this.threshold - LEEWAY;
      case 'above':
        return value > this.threshold + LEEWAY;
      case 'below':
        return value < this.threshold - LEEWAY;
    }
  }

  equals(other: AlertRule): boolean {
    return this.key === other.key;
  }

  setAlike(other: AlertRule): boolean {
    return (
      this.equals(other) &&
      this.threshold === other.threshold &&
      this.over === other.over
    );
  }
}
