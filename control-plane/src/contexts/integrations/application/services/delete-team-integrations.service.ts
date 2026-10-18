import { HookDeletionRequested } from '@integrations/domain/events/hook-deletion-requested.event';
import { IntegrationDeletionRequested } from '@integrations/domain/events/integration-deletion-requested.event';
import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import type { InferredOutputSchemaRepository } from '@integrations/domain/repositories/inferred-output-schema.repository';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteTeamIntegrations {
  constructor(
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly hooks: HookDefinitionRepository,
    private readonly connections: IntegrationConnectionRepository,
    private readonly registrations: OAuth2ClientRegistrationRepository,
    private readonly schemas: InferredOutputSchemaRepository,
    private readonly policies: PersonToolPolicyRepository,
  ) {}

  async deleteConnectionsForTeam(teamId: TeamId): Promise<void> {
    await this.connections.deleteForTeam(teamId);
    await this.registrations.deleteForTeam(teamId);
    await this.schemas.deleteForTeam(teamId);
    await this.policies.deleteForTeam(teamId);
  }

  async pendingDeletions(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<readonly DomainEvent[]> {
    const hooks = await this.hooks.ofTeam(teamId);
    const integrations = await this.definitions.ofTeam(teamId);

    return [
      ...hooks.map((hook) => new HookDeletionRequested(hook.id, workspaceId)),
      ...integrations.map(
        (integration) =>
          new IntegrationDeletionRequested(integration.id, workspaceId),
      ),
    ];
  }

  async deleteHook(
    id: HookDefinitionId,
    workspaceId: WorkspaceId,
  ): Promise<void> {
    const hook = await this.hooks.withId(id);

    if (hook) {
      await this.hooks.save(
        hook.cascadeDelete(ChangeActor.spotlight(workspaceId)),
      );
    }
  }

  async deleteIntegration(
    id: IntegrationDefinitionId,
    workspaceId: WorkspaceId,
  ): Promise<void> {
    const integration = await this.definitions.withId(id);

    if (integration) {
      await this.definitions.save(
        integration.cascadeDelete(ChangeActor.spotlight(workspaceId)),
      );
    }
  }
}
