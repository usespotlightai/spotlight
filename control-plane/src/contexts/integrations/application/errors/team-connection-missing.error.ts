import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class TeamConnectionMissingError extends ApplicationError {
  readonly kind = 'not-found' as const;

  constructor(readonly integration: string) {
    super(
      `Integration ${integration} has no team connection. Connect the team account to read its deliveries.`,
    );
    this.name = 'TeamConnectionMissingError';
  }
}
