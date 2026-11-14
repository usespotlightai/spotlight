import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TeamNotFoundError extends DomainError {
  readonly kind = 'not-found' as const;

  constructor(teamId: string) {
    super(`Team ${teamId} not found.`);
    this.name = 'TeamNotFoundError';
  }
}
