import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotActingOnTeamError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(teamId: string) {
    super(
      `You can see team ${teamId}, but only people who work on it can do this.`,
    );
    this.name = 'NotActingOnTeamError';
  }
}
