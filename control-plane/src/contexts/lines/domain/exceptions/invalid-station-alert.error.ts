import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export type StationAlertField =
  | 'measure'
  | 'risesBy'
  | 'above'
  | 'fallsBy'
  | 'below'
  | 'over';

export class InvalidStationAlertError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: StationAlertField | null,
    reason: string,
  ) {
    super(`Alert ${reason}.`);
    this.name = 'InvalidStationAlertError';
  }
}
