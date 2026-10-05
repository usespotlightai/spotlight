import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { OAuth2Endpoints } from '@integrations/infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Discovery } from '@integrations/infrastructure/integrations/oauth2-discovery';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export async function oauth2Of(
  defined: DefinedIntegrationsPort,
  reader: IntegrationReader,
  discovery: OAuth2Discovery,
  teamId: TeamId,
  source: string,
): Promise<OAuth2Endpoints | null> {
  const definitions = await defined.ofTeam(teamId);

  for (const readable of reader.readable(definitions).integrations) {
    const oauth2 = readable.connection?.oauth2;

    if (readable.integration.source.value === source && oauth2) {
      return discovery.endpoints(oauth2);
    }
  }

  return null;
}
