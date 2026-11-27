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

  // A name that is not a slug. Its reason is advice, so that it reads on its own under the field it is about.
  static notSlug(
    identifierKind: string,
    example: string,
    otherwise?: string,
  ): InvalidIdentifierError {
    const advice = `${slugAdvice(example, otherwise)}.`;

    return new InvalidIdentifierError(
      identifierKind,
      advice,
      `${capitalised(identifierKind)} is not valid. ${advice}`,
    );
  }
}
