export type StationAlertField =
  | 'measure'
  | 'risesBy'
  | 'above'
  | 'fallsBy'
  | 'below'
  | 'over';

export class InvalidStationAlertError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly field: StationAlertField | null,
    reason: string,
  ) {
    super(`An alert ${reason}`);
    this.name = 'InvalidStationAlertError';
  }
}
