import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class ReservedSecretValueError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(readonly secretName: string) {
    super(
      `Secret ${secretName} is Spotlight's own. Only Spotlight sets its value.`,
    );
    this.name = 'ReservedSecretValueError';
  }
}
