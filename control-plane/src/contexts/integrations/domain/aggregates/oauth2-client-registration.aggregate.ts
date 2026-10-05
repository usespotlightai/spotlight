import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface State {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly source: SourceKey;
  readonly registrationEndpoint: string;
  readonly redirectUri: string;
  readonly clientId: string;
  readonly clientSecret: AccessToken | null;
  readonly secretExpiresAt: Date | null;
  readonly version: number;
}

type Registered = Omit<State, 'version'>;

export class OAuth2ClientRegistration {
  private constructor(private readonly state: State) {}

  static registered(input: Registered): OAuth2ClientRegistration {
    if (input.clientId.trim().length === 0) {
      throw new InconsistentStateError(
        'oauth2 client registration',
        'was answered without a client id',
      );
    }

    return new OAuth2ClientRegistration({ ...input, version: 0 });
  }

  static rehydrate(input: State): OAuth2ClientRegistration {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'oauth2 client registration',
        'was kept without a version',
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

  get source(): SourceKey {
    return this.state.source;
  }

  get registrationEndpoint(): string {
    return this.state.registrationEndpoint;
  }

  get redirectUri(): string {
    return this.state.redirectUri;
  }

  get clientId(): string {
    return this.state.clientId;
  }

  get clientSecret(): AccessToken | null {
    return this.state.clientSecret;
  }

  get secretExpiresAt(): Date | null {
    return this.state.secretExpiresAt;
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
    wanted: { registrationEndpoint: string; redirectUri: string },
    now: Date,
  ): boolean {
    return (
      this.state.registrationEndpoint === wanted.registrationEndpoint &&
      this.state.redirectUri === wanted.redirectUri &&
      this.liveAt(now)
    );
  }

  replacedBy(next: OAuth2ClientRegistration): OAuth2ClientRegistration {
    if (!next.teamId.equals(this.teamId) || !next.source.equals(this.source)) {
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
    return this.teamId.equals(other.teamId) && this.source.equals(other.source);
  }
}
