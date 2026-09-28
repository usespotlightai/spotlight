import type {
  IntegrationReaderPort,
  ReadIntegrations,
} from '@configuration/application/ports/integration-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { LinkedHostsPort } from '@integrations/application/ports/linked-hosts.port';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class IntegrationReadings implements IntegrationReaderPort {
  constructor(
    private readonly defined: DefinedIntegrationsPort,
    private readonly linked: LinkedHostsPort,
    private readonly reader: IntegrationReader,
  ) {}

  async ofTeam(teamId: TeamId): Promise<ReadIntegrations> {
    const [definitions, links] = await Promise.all([
      this.defined.ofTeam(teamId),
      this.linked.ofTeam(teamId),
    ]);
    const handles = new Map(links.map((each) => [each.source, each.handle]));
    const read = this.reader.read(definitions);

    return {
      integrations: read.integrations.map((each) => ({
        ...each,
        linked: handles.has(each.source),
        handle: handles.get(each.source) ?? null,
      })),
      problems: read.problems,
    };
  }
}
