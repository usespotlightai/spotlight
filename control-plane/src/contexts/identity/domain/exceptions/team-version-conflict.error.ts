import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class TeamVersionConflictError extends DomainError {
  readonly kind = 'conflict' as const;

  constructor(teamId: string) {
    super(
      `Team ${teamId} changed since you loaded it. Please reload and try again.`,
    );
    this.name = 'TeamVersionConflictError';
  }
}
