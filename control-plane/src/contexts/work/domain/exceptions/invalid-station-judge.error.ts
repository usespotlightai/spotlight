export type StationJudgeField =
  | 'rubric'
  | 'claims'
  | 'passThreshold'
  | 'sample'
  | 'minAgreement';

export class InvalidStationJudgeError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: StationJudgeField,
    reason: string,
  ) {
    super(`Judge ${field} ${reason}.`);
    this.name = 'InvalidStationJudgeError';
  }
}
