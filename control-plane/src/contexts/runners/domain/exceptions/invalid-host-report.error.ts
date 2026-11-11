import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidHostReportError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: string,
    rule: string,
  ) {
    super(`Host ${field} ${rule}.`);
    this.name = 'InvalidHostReportError';
  }
}
