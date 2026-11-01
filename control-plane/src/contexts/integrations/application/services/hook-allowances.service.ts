import type { HookTokensPort } from '@integrations/application/ports/hook-tokens.port';
import type { OutboundHostsPort } from '@integrations/application/ports/outbound-hosts.port';
import type { WorkspaceHostsPort } from '@integrations/application/ports/workspace-hosts.port';
import type { HookAllowances } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class HookAllowancesService {
  constructor(
    private readonly integrations: IntegrationDefinitionRepository,
    private readonly tokens: HookTokensPort,
    private readonly hosts: OutboundHostsPort,
    private readonly workspaceHosts: WorkspaceHostsPort,
  ) {}

  async onTeam(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<HookAllowances> {
    const provided = (await this.integrations.ofTeam(teamId)).flatMap(
      (each) => each.tools,
    );
    const workspaceHosts = await this.workspaceHosts.fresh(workspaceId.value);

    return {
      provided,
      signsTokens: this.tokens.signs,
      allowsHost: (host) =>
        this.hosts.allows(host) && workspaceHosts.allows(host),
    };
  }
}
