import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export type OAuth2ServerFailure = 'no-endpoints' | 'registration-failed';

const MESSAGES: Record<OAuth2ServerFailure, (integration: string) => string> = {
  'no-endpoints': (integration) =>
    `OAuth2 endpoints for integration ${integration} not found.`,
  'registration-failed': (integration) =>
    `Client registration for integration ${integration} failed.`,
};

export class OAuth2ServerUnavailableError extends ApplicationError {
  readonly kind = 'upstream-error' as const;

  constructor(
    integration: string,
    readonly failure: OAuth2ServerFailure,
  ) {
    super(MESSAGES[failure](integration));
    this.name = 'OAuth2ServerUnavailableError';
  }
}
