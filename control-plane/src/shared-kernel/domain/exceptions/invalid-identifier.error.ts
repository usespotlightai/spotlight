import { capitalised } from '@shared-kernel/domain/capitalised';

export class InvalidIdentifierError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    kind: string,
    readonly because = 'must not be empty',
  ) {
    super(`${capitalised(kind)} identifier ${because}.`);
    this.name = 'InvalidIdentifierError';
  }
}
