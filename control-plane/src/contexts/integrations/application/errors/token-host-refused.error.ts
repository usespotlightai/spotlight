import { ApplicationError } from '@shared-kernel/application/errors/application-error';

export class TokenHostRefusedError extends ApplicationError {
  readonly kind = 'not-allowed' as const;

  constructor(readonly host: string) {
    super(
      `${host} is not a host the integration names, so Spotlight did not send the connection token there. Add ${host} to connection.oauth2.hosts.`,
    );
    this.name = 'TokenHostRefusedError';
  }
}
