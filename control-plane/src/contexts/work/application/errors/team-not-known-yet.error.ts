import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class TeamNotKnownYetError extends ApplicationError {
  readonly kind = 'conflict' as const;

  constructor(teamId: string) {
    super(
      `Team ${teamId} is not known to Work yet. Please try again in a moment.`,
    );
    this.name = 'TeamNotKnownYetError';
  }
}
