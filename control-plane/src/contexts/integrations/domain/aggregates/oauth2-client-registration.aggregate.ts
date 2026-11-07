import type { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import type { ClientSecret } from '@integrations/domain/value-objects/client-secret.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { OAuth2ClientId } from '@integrations/domain/value-objects/oauth2-client-id.vo';
import type { OAuth2Endpoint } from '@integrations/domain/value-objects/oauth2-endpoint.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly integration: IntegrationKey;
  readonly registrationEndpoint: OAuth2Endpoint;
  readonly redirectUri: OAuth2Endpoint;
  readonly server: AuthorizationServer | null;
  readonly clientId: OAuth2ClientId;
  readonly clientSecret: ClientSecret | null;
  readonly secretExpiresAt: Date | null;
  readonly registeredAt: Date;
  readonly version: number;
}

type Registered = Omit<State, 'version'>;

export class OAuth2ClientRegistration {
  private constructor(private readonly state: State) {}

  static register(input: Registered): OAuth2ClientRegistration {
    return new OAuth2ClientRegistration({ ...input, version: 0 });
  }

  static rehydrate(input: State): OAuth2ClientRegistration {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'oauth2 client registration',
        'was stored without a version',
      );
    }

    return new OAuth2ClientRegistration(input);
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get integration(): IntegrationKey {
    return this.state.integration;
  }

  get registrationEndpoint(): OAuth2Endpoint {
    return this.state.registrationEndpoint;
  }

  get redirectUri(): OAuth2Endpoint {
    return this.state.redirectUri;
  }

  get server(): AuthorizationServer | null {
    return this.state.server;
  }

  get clientId(): OAuth2ClientId {
    return this.state.clientId;
  }

  get clientSecret(): ClientSecret | null {
    return this.state.clientSecret;
  }

  get secretExpiresAt(): Date | null {
    return this.state.secretExpiresAt;
  }

  get registeredAt(): Date {
    return this.state.registeredAt;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  liveAt(now: Date): boolean {
    const { secretExpiresAt } = this.state;

    return (
      secretExpiresAt === null || secretExpiresAt.getTime() > now.getTime()
    );
  }

  fits(
    wanted: {
      registrationEndpoint: OAuth2Endpoint;
      redirectUri: OAuth2Endpoint;
      server: AuthorizationServer | null;
    },
    now: Date,
  ): boolean {
    return (
      this.state.registrationEndpoint.equals(wanted.registrationEndpoint) &&
      this.state.redirectUri.equals(wanted.redirectUri) &&
      this.servedBy(wanted.server) &&
      this.liveAt(now)
    );
  }

  servedBy(server: AuthorizationServer | null): boolean {
    const pinned = this.state.server;

    return pinned === null || server === null
      ? pinned === server
      : pinned.equals(server);
  }

  replaceWith(next: OAuth2ClientRegistration): OAuth2ClientRegistration {
    if (
      !next.teamId.equals(this.teamId) ||
      !next.integration.equals(this.integration)
    ) {
      throw new InconsistentStateError(
        'oauth2 client registration',
        'can only be replaced by one for the same team and integration',
      );
    }

    return new OAuth2ClientRegistration({
      ...next.state,
      version: this.state.version,
    });
  }

  equals(other: OAuth2ClientRegistration): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.integration.equals(other.integration)
    );
  }
}
