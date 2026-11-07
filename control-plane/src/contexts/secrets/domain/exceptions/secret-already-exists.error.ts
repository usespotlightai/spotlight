import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class SecretAlreadyExistsError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly secretName: string) {
    super(
      `A secret named ${secretName} already exists. Please choose another name.`,
    );
    this.name = 'SecretAlreadyExistsError';
  }
}
