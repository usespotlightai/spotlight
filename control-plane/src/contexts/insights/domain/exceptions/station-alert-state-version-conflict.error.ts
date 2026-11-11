import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class StationAlertStateVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationId: string) {
    super(
      `Alerts of station ${stationId} changed since you loaded them. Please reload and try again.`,
    );
    this.name = 'StationAlertStateVersionConflictError';
  }
}
