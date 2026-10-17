import type { AuthorizationServer } from '@integrations/domain/value-objects/authorization-server.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const OAUTH2_CLIENTS = Symbol('OAUTH2_CLIENTS');

export interface OAuth2Client {
  readonly id: string;
  readonly secret: string | null;
}

export interface OAuth2ClientsPort {
  clientFor(
    teamId: TeamId,
    source: SourceKey,
    registration: string | null,
    server: AuthorizationServer | null,
  ): Promise<OAuth2Client | null>;

  existingFor(
    teamId: TeamId,
    source: SourceKey,
    server: AuthorizationServer | null,
  ): Promise<OAuth2Client | null>;
}
