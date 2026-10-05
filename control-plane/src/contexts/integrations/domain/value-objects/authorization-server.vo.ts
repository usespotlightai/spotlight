import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';

const isWebAddress = (raw: string): boolean => {
  try {
    const url = new URL(raw);

    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

export class AuthorizationServer {
  private constructor(
    readonly issuer: string,
    readonly authorize: string,
    readonly token: string,
  ) {}

  static of(input: {
    issuer: string;
    authorize: string;
    token: string;
  }): AuthorizationServer {
    for (const [part, address] of Object.entries(input)) {
      if (!isWebAddress(address)) {
        throw new InvalidIntegrationPartError(
          'authorization server',
          `names its ${part} at ${JSON.stringify(address)}, which is not a web address`,
        );
      }
    }

    return new AuthorizationServer(input.issuer, input.authorize, input.token);
  }

  equals(other: AuthorizationServer): boolean {
    return (
      this.issuer === other.issuer &&
      this.authorize === other.authorize &&
      this.token === other.token
    );
  }
}
