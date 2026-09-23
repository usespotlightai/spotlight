import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { ConnectionIR } from '@integrations/infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export async function oauth2Of(
  defined: DefinedIntegrationsPort,
  reader: IntegrationReader,
  teamId: TeamId,
  source: string,
): Promise<NonNullable<ConnectionIR['oauth2']> | null> {
  const definitions = await defined.ofTeam(teamId);

  for (const readable of reader.readable(definitions).integrations) {
    const oauth2 = readable.connection?.oauth2;

    if (readable.integration.source.value === source && oauth2) {
      return oauth2;
    }
  }

  return null;
}
