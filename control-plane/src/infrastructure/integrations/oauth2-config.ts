import { integrationFilesIn } from '@application/contracts/configuration-layout.contract';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { ConnectionIR } from '@infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';

export async function oauth2Of(
  configurations: TeamConfigurationRepository,
  reader: IntegrationReader,
  teamId: TeamId,
  source: string,
): Promise<NonNullable<ConnectionIR['oauth2']> | null> {
  const applied = await configurations.findFor(teamId);

  if (!applied) {
    return null;
  }

  for (const readable of reader.readable(integrationFilesIn(applied.files))
    .integrations) {
    const oauth2 = readable.connection?.oauth2;

    if (readable.integration.source.value === source && oauth2) {
      return oauth2;
    }
  }

  return null;
}
