import { HookAbandonmentDue } from '@integrations/domain/events/hook-abandonment-due.event';
import { IntegrationAbandonmentDue } from '@integrations/domain/events/integration-abandonment-due.event';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { LearnedOutputRepository } from '@integrations/domain/repositories/learned-output.repository';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class AbandonTeamIntegrations {
  constructor(
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly hooks: HookDefinitionRepository,
    private readonly connections: HostConnectionRepository,
    private readonly registrations: OAuth2ClientRegistrationRepository,
    private readonly learned: LearnedOutputRepository,
    private readonly policies: PersonToolPolicyRepository,
  ) {}

  async connectionsOf(teamId: TeamId): Promise<void> {
    await this.connections.forgetTeam(teamId);
    await this.registrations.forgetTeam(teamId);
    await this.learned.forgetTeam(teamId);
    await this.policies.forgetTeam(teamId);
  }

  async pendingAbandonments(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    const hooks = await this.hooks.ofTeam(teamId);
    const integrations = await this.definitions.ofTeam(teamId);

    return [
      ...hooks.map((hook) => new HookAbandonmentDue(hook.id, workspaceId)),
      ...integrations.map(
        (integration) =>
          new IntegrationAbandonmentDue(integration.id, workspaceId),
      ),
    ];
  }

  async hook(id: HookDefinitionId, workspaceId: WorkspaceId): Promise<void> {
    const hook = await this.hooks.withId(id);

    if (hook) {
      await this.hooks.save(hook.abandon(Attribution.spotlight(workspaceId)));
    }
  }

  async integration(
    id: IntegrationDefinitionId,
    workspaceId: WorkspaceId,
  ): Promise<void> {
    const integration = await this.definitions.withId(id);

    if (integration) {
      await this.definitions.save(
        integration.abandon(Attribution.spotlight(workspaceId)),
      );
    }
  }
}
