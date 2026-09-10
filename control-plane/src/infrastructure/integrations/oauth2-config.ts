import { INTEGRATIONS_UNDER } from '@domain/aggregates/team-configuration.aggregate';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import type { TeamId } from '@domain/value-objects/team-id.vo';
import type { ConnectionIR } from '@infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@infrastructure/integrations/integration.reader';

/**
 * The endpoints a team links one host through, read out of its configuration.
 * Shared by beginning a link, finishing one, and keeping its tokens fresh, so
 * they all read the same file the same way.
 */
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

  for (const readable of reader.readable(applied.under(INTEGRATIONS_UNDER))
    .integrations) {
    const oauth2 = readable.connection?.oauth2;

    if (readable.integration.source.value === source && oauth2) {
      return oauth2;
    }
  }

  return null;
}
