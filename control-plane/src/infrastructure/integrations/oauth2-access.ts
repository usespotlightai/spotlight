import type { HostConnectionRepository } from '@domain/repositories/host-connection.repository';
import { SourceKey } from '@domain/value-objects/source-key.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { ReadableIntegration } from '@infrastructure/integrations/integration.compile';

export class OAuth2Access {
  constructor(private readonly connections: HostConnectionRepository) {}

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
