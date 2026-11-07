import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class CallSecretsExpiredError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(id: string, state: string) {
    super(
      `Network call ${id} is ${state}. Its secrets can no longer be redeemed.`,
    );
    this.name = 'CallSecretsExpiredError';
  }
}
