import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidReplayedPeriodError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor() {
    super('Period must be 7d, 30d or 90d.');
    this.name = 'InvalidReplayedPeriodError';
  }
}
