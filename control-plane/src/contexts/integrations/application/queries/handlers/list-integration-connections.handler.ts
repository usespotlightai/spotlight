import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { IntegrationConnectionsDto } from '@integrations/application/dto/integration-connections.dto';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationConnectionRosterPort } from '@integrations/application/ports/integration-connection-roster.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import type { PersonToolRulesPort } from '@integrations/application/ports/person-tool-rules.port';
import type { ListIntegrationConnectionsQuery } from '@integrations/application/queries/list-integration-connections.query';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
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
    private readonly rules: PersonToolRulesPort,
    private readonly runtime: IntegrationRuntimePort,
  ) {}

  async execute(
    query: ListIntegrationConnectionsQuery,
  ): Promise<IntegrationConnectionsDto | null> {
    try {
      const membership = await this.access.inWorkspaceOfTeam(
        TeamId.of(query.teamId),
        UserId.of(query.viewerId),
      );

      if (!membership) {
        return null;
      }

      const teamId = TeamId.of(query.teamId);
      const viewer = UserId.of(query.viewerId);
      const [connected, defined, rules] = await Promise.all([
        this.roster.ofTeam(teamId),
        this.defined.ofTeam(teamId),
        this.rules.ofPerson(teamId, viewer),
      ]);
      const offered = this.runtime.offered(defined);
      const mine = connected
        .filter((each) => each.personId.equals(viewer))
        .map(({ integration, linkedAccount, connectedAt }) => {
          const tools = offered.find((each) =>
            each.integration.key.equals(integration),
          );

          return {
            integration: integration.value,
            linkedAccount,
            connectedAt,
            tools: (tools?.all ?? [])
              .filter((tool) => tools?.takesPersonRuleFor(tool))
              .map((tool) => ({
                tool: tool.value,
                rule: (rules.get(tool.value) ?? PersonToolRule.allowed()).name,
              })),
          };
        });

      if (!membership.isAdmin) {
        return { mine, people: null };
      }

      const named = await this.people.findMany([
        ...new Map(
          connected.map((each) => [each.personId.value, each.personId]),
        ).values(),
      ]);

      return {
        mine,
        people: connected.map((each) => ({
          integration: each.integration.value,
          personId: each.personId.value,
          name: named.get(each.personId.value)?.name ?? '',
          linkedAccount: each.linkedAccount,
          connectedAt: each.connectedAt,
        })),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
