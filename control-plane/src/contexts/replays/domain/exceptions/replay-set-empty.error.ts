import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReplaySetEmptyError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(stationKey: string) {
    super(`Station ${stationKey} has no runs in its replay set yet.`);
    this.name = 'ReplaySetEmptyError';
  }
}
