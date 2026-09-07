import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { ReadableIntegration } from '@infrastructure/integrations/integration.compile';

/**
 * The token an outbound call authenticates a team's host with: whatever the
 * team's connection holds. It only reads — the token is kept fresh elsewhere, by
 * the keeper that renews connections before they expire — so authenticating a
 * call never changes anything.
 */
export class OAuth2Access {
  constructor(private readonly connections: HostConnectionRepository) {}

  /** The token to authenticate as this team, or null where none can be. */
  async token(
    teamId: TeamId,
    readable: ReadableIntegration,
  ): Promise<string | null> {
    if (!readable.connection?.oauth2) {
      return null;
    }

    const source = SourceKey.of(readable.integration.source.value);
    const connection = await this.connections.of(teamId, source);

    return connection?.accessToken ?? null;
  }
}
