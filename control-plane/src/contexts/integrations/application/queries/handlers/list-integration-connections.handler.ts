import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { IntegrationConnectionsDto } from '@integrations/application/dto/integration-connections.dto';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationConnectionRosterPort } from '@integrations/application/ports/integration-connection-roster.port';
import type { ListIntegrationConnectionsQuery } from '@integrations/application/queries/list-integration-connections.query';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ListIntegrationConnectionsHandler
  implements
    QueryHandlerPort<
      ListIntegrationConnectionsQuery,
      IntegrationConnectionsDto | null
    >
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly roster: IntegrationConnectionRosterPort,
    private readonly people: PersonReaderPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly policies: PersonToolPolicyRepository,
  ) {}

  async execute(
    query: ListIntegrationConnectionsQuery,
  ): Promise<IntegrationConnectionsDto | null> {
    try {
      const membership = await this.access.onTeam(
        query.teamId,
        UserId.of(query.viewerId),
      );

      if (!membership) {
        return null;
      }

      const teamId = TeamId.of(query.teamId);
      const viewer = UserId.of(query.viewerId);
      const [connected, defined, policies] = await Promise.all([
        this.roster.ofTeam(teamId),
        this.defined.ofTeam(teamId),
        this.policies.ofPerson(teamId, viewer),
      ]);
      const mine = connected
        .filter((each) => each.personId === query.viewerId)
        .map(({ integration, linkedAccount, connectedAt }) => {
          const policy = policies.find(
            (each) => each.integration.value === integration,
          );

          return {
            integration,
            linkedAccount,
            connectedAt,
            tools: (
              defined.find((each) => each.integration === integration)?.tools ??
              []
            ).map((tool) => ({
              tool,
              rule: policy?.ruleFor(ToolName.of(tool)).name ?? 'allowed',
            })),
          };
        });

      if (!membership.isAdmin) {
        return { mine, people: null };
      }

      const named = await this.people.findMany(
        [...new Set(connected.map((each) => each.personId))].map((id) =>
          UserId.of(id),
        ),
      );

      return {
        mine,
        people: connected.map((each) => ({
          integration: each.integration,
          personId: each.personId,
          name: named.get(each.personId)?.name ?? '',
          linkedAccount: each.linkedAccount,
          connectedAt: each.connectedAt,
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
