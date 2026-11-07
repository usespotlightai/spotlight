import { capitalised } from '@shared-kernel/domain/capitalised';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidIdentifierError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    identifierKind: string,
    readonly because = 'must not be empty',
  ) {
    super(`${capitalised(identifierKind)} identifier ${because}.`);
    this.name = 'InvalidIdentifierError';
  }
}
