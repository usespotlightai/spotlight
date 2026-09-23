import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { ConnectionIR } from '@integrations/infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export async function oauth2Of(
  configurations: AppliedConfigurationPort,
  reader: IntegrationReader,
  teamId: TeamId,
  source: string,
): Promise<NonNullable<ConnectionIR['oauth2']> | null> {
  const applied = await configurations.of(teamId);

  if (!applied) {
    return null;
  }

  for (const readable of reader.readable(applied.integrations).integrations) {
    const oauth2 = readable.connection?.oauth2;

    if (readable.integration.source.value === source && oauth2) {
      return oauth2;
    }
  }

  return null;
}
