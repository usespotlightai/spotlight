import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';

export const JUDGE_CALIBRATION_STATES = [
  'qualified',
  'unmeasured',
  'failing',
] as const;

export type JudgeCalibrationState = (typeof JUDGE_CALIBRATION_STATES)[number];

export interface JudgeCalibrationFields {
  readonly state: string;
  readonly agreement: number | null;
  readonly pairs: number;
  readonly minPairs: number;
  readonly minAgreement: number | null;
}

const isState = (raw: string): raw is JudgeCalibrationState =>
  JUDGE_CALIBRATION_STATES.some((each) => each === raw);

const isCount = (value: number, from: number): boolean =>
  Number.isInteger(value) && value >= from;

const isWithin = (value: number | null, from: number): boolean =>
  value === null || (Number.isFinite(value) && value >= from && value <= 1);

export class JudgeCalibration {
  private constructor(
    readonly state: JudgeCalibrationState,
    readonly agreement: number | null,
    readonly pairs: number,
    readonly minPairs: number,
    readonly minAgreement: number | null,
  ) {}

  static of(fields: JudgeCalibrationFields): JudgeCalibration {
    if (!isState(fields.state)) {
      throw new InvalidReplayCheckError(
        `judge calibration must be ${JUDGE_CALIBRATION_STATES.join(', ')}, not ${fields.state}`,
      );
    }
    if (!isCount(fields.pairs, 0) || !isCount(fields.minPairs, 1)) {
      throw new InvalidReplayCheckError(
        'judge calibration must count its pairs in whole numbers',
      );
    }
    if (!isWithin(fields.agreement, -1) || !isWithin(fields.minAgreement, 0)) {
      throw new InvalidReplayCheckError(
        'judge calibration agreement must be from -1 to 1, and its minimum from 0 to 1',
      );
    }
    if (fields.state === 'qualified' && fields.agreement === null) {
      throw new InvalidReplayCheckError(
        'a qualified judge calibration must have an agreement',
      );
    }

    return new JudgeCalibration(
      fields.state,
      fields.agreement,
      fields.pairs,
      fields.minPairs,
      fields.minAgreement,
    );
  }

  fails(): boolean {
    return this.state === 'failing';
  }

  toFields(): JudgeCalibrationFields {
    return {
      state: this.state,
      agreement: this.agreement,
      pairs: this.pairs,
      minPairs: this.minPairs,
      minAgreement: this.minAgreement,
    };
  }
}
