import type { HookTokensPort } from '@integrations/application/ports/hook-tokens.port';
import type { OutboundHostsPort } from '@integrations/application/ports/outbound-hosts.port';
import type { HookAllowances } from '@integrations/domain/aggregates/hook-definition.aggregate';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HookAllowancesService {
  constructor(
    private readonly integrations: IntegrationDefinitionRepository,
    private readonly tokens: HookTokensPort,
    private readonly hosts: OutboundHostsPort,
  ) {}

  async onTeam(teamId: TeamId): Promise<HookAllowances> {
    const offered = (await this.integrations.ofTeam(teamId)).flatMap(
      (each) => each.offers,
    );

    return {
      offered,
      signsTokens: this.tokens.signs,
      allowsHost: (host) => this.hosts.allows(host),
    };
  }
}
