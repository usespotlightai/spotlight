import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownAlertError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(alertId: string) {
    super(`Alert ${alertId} not found.`);
    this.name = 'UnknownAlertError';
  }
}
