import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class NotOnTheTeamAskedError extends DomainError {
  readonly kind = 'not-allowed' as const;

  constructor(taskId: string) {
    super(
      `Task ${taskId} waits for its team. Only a member of the team can answer it.`,
    );
    this.name = 'NotOnTheTeamAskedError';
  }
}
