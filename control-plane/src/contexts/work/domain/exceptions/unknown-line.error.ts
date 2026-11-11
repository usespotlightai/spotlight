import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class UnknownLineError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(lineId: string) {
    super(`Line ${lineId} not found.`);
    this.name = 'UnknownLineError';
  }
}
