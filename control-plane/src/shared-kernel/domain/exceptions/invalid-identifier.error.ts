import { capitalised } from '@shared-kernel/domain/capitalised';

export class InvalidIdentifierError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    identifierKind: string,
    readonly because = 'must not be empty',
  ) {
    super(`${capitalised(identifierKind)} identifier ${because}.`);
    this.name = 'InvalidIdentifierError';
  }
}
