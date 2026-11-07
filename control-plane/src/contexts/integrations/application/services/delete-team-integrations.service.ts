import type { HookDefinitionRepository } from '@integrations/domain/repositories/hook-definition.repository';
import type { InferredOutputSchemaRepository } from '@integrations/domain/repositories/inferred-output-schema.repository';
import type { IntegrationConnectionRepository } from '@integrations/domain/repositories/integration-connection.repository';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { OAuth2ClientRegistrationRepository } from '@integrations/domain/repositories/oauth2-client-registration.repository';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
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

  async deleteHooks(teamId: TeamId, workspaceId: WorkspaceId): Promise<void> {
    for (const hook of await this.hooks.ofTeam(teamId)) {
      await this.hooks.save(hook.delete(ChangeActor.spotlight(workspaceId)));
    }
  }

  async deleteIntegrations(
    teamId: TeamId,
    workspaceId: WorkspaceId,
  ): Promise<void> {
    for (const integration of await this.definitions.ofTeam(teamId)) {
      await this.definitions.save(
        integration.cascadeDelete(ChangeActor.spotlight(workspaceId)),
      );
    }
  }

  async disconnectConnections(teamId: TeamId): Promise<void> {
    for (const connection of await this.connections.ofTeam(teamId)) {
      await this.connections.remove(connection);
    }
  }

  async removeClientRegistrations(teamId: TeamId): Promise<void> {
    for (const registration of await this.registrations.ofTeam(teamId)) {
      await this.registrations.remove(registration);
    }
  }

  async removeInferredOutputSchemas(teamId: TeamId): Promise<void> {
    for (const schema of await this.schemas.ofTeam(teamId)) {
      await this.schemas.remove(schema);
    }
  }

  async removePersonToolPolicies(teamId: TeamId): Promise<void> {
    for (const policy of await this.policies.ofTeam(teamId)) {
      await this.policies.remove(policy);
    }
  }
}
