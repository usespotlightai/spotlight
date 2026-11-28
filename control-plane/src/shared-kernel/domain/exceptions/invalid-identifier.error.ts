import { capitalised } from '@shared-kernel/domain/capitalised';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';
import { slugAdvice } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class InvalidIdentifierError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    identifierKind: string,
    readonly because = 'must not be empty',
    message = `${capitalised(identifierKind)} identifier ${because}.`,
  ) {
    super(message);
    this.name = 'InvalidIdentifierError';
  }

  static notSlug(
    identifierKind: string,
    example: string,
    otherShape?: string,
  ): InvalidIdentifierError {
    const advice = `${slugAdvice(example, otherShape)}.`;

    return new InvalidIdentifierError(
      identifierKind,
      advice,
      `${capitalised(identifierKind)} is not valid. ${advice}`,
    );
  }
}
