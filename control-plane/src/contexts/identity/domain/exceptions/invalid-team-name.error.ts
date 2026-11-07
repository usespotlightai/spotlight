import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class InvalidTeamNameError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(readonly because: string) {
    super(`Team name ${because}.`);
    this.name = 'InvalidTeamNameError';
  }
}
