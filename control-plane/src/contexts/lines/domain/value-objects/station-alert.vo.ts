import { InvalidStationAlertError } from '@lines/domain/exceptions/invalid-station-alert.error';
import { firstOf } from '@shared-kernel/domain/item-at';

export const ALERT_MEASURES = [
  'sent_back_rate',
  'accepted_rate',
  'checks_failed_rate',
  'failed_rate',
  'merged_rate',
  'cost_per_run',
] as const;

export type AlertMeasure = (typeof ALERT_MEASURES)[number];

const RATES: ReadonlySet<AlertMeasure> = new Set([
  'sent_back_rate',
  'accepted_rate',
  'checks_failed_rate',
  'failed_rate',
  'merged_rate',
]);

const CONDITIONS = ['risesBy', 'above', 'fallsBy', 'below'] as const;

type Condition = (typeof CONDITIONS)[number];

const MOVES: ReadonlySet<Condition> = new Set(['risesBy', 'fallsBy']);

const CONDITION_DESCRIPTION: Record<Condition, string> = {
  risesBy: 'rises by',
  above: 'is above',
  fallsBy: 'falls by',
  below: 'is below',
};

const isMeasure = (measure: string): measure is AlertMeasure =>
  (ALERT_MEASURES as readonly string[]).includes(measure);

const bounded = (
  measure: AlertMeasure,
  condition: Condition,
  value: number,
): boolean =>
  Number.isFinite(value) &&
  (MOVES.has(condition) ? value > 0 : value >= 0) &&
  (!RATES.has(measure) || value <= 1);

const bounds = (measure: AlertMeasure, condition: Condition): string => {
  const moves = MOVES.has(condition);

  if (RATES.has(measure)) {
    return moves ? 'a share above 0 and at most 1' : 'a share from 0 to 1';
  }

  return moves ? 'an amount above 0' : 'an amount of 0 or more';
};

export class StationAlert {
  private constructor(
    readonly measure: AlertMeasure,
    readonly risesBy: number | null,
    readonly above: number | null,
    readonly fallsBy: number | null,
    readonly below: number | null,
    readonly over: number,
  ) {}

  static of(input: {
    measure: string;
    risesBy?: number | null;
    above?: number | null;
    fallsBy?: number | null;
    below?: number | null;
    over: number;
  }): StationAlert {
    const { measure } = input;
    const set = CONDITIONS.flatMap((condition) => {
      const value = input[condition] ?? null;

      return value === null ? [] : [{ condition, value }];
    });
    const only = set.length === 1 ? firstOf(set) : undefined;

    if (!isMeasure(measure)) {
      throw new InvalidStationAlertError(
        'measure',
        `measure must be one of ${ALERT_MEASURES.join(', ')}`,
      );
    }
    if (only === undefined) {
      throw new InvalidStationAlertError(
        null,
        `must set exactly one of ${CONDITIONS.join(', ')}`,
      );
    }

    const { condition, value } = only;

    if (!bounded(measure, condition, value)) {
      throw new InvalidStationAlertError(
        condition,
        `"${CONDITION_DESCRIPTION[condition]}" value must be ${bounds(measure, condition)}`,
      );
    }
    if (!Number.isInteger(input.over) || input.over < 1) {
      throw new InvalidStationAlertError(
        'over',
        'must compare a whole number of runs, at least 1',
      );
    }

    const at = (each: Condition): number | null =>
      each === condition ? value : null;

    return new StationAlert(
      measure,
      at('risesBy'),
      at('above'),
      at('fallsBy'),
      at('below'),
      input.over,
    );
  }

  static together(alerts: readonly StationAlert[]): readonly StationAlert[] {
    return alerts.map((each, at) => each.alongside(alerts.slice(0, at)));
  }

  get condition(): Condition {
    const condition = CONDITIONS.find((each) => this[each] !== null);

    if (condition === undefined) {
      throw new InvalidStationAlertError(
        null,
        `must set exactly one of ${CONDITIONS.join(', ')}`,
      );
    }

    return condition;
  }

  watchesAsWell(other: StationAlert): boolean {
    return this.measure === other.measure && this.condition === other.condition;
  }

  alongside(earlier: readonly StationAlert[]): StationAlert {
    if (earlier.some((each) => each.watchesAsWell(this))) {
      throw new InvalidStationAlertError(
        null,
        `for "${this.measure} ${CONDITION_DESCRIPTION[this.condition]}" already exists on this station`,
      );
    }

    return this;
  }

  equals(other: StationAlert): boolean {
    return (
      this.measure === other.measure &&
      this.risesBy === other.risesBy &&
      this.above === other.above &&
      this.fallsBy === other.fallsBy &&
      this.below === other.below &&
      this.over === other.over
    );
  }
}
