export type StationJudgeField =
  | 'rubric'
  | 'claims'
  | 'passShare'
  | 'sample'
  | 'trust';

export class InvalidStationJudgeError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: StationJudgeField,
    reason: string,
  ) {
    super(`Judge ${field} ${reason}.`);
    this.name = 'InvalidStationJudgeError';
  }
}
