import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { SetPersonToolRuleCommand } from '@integrations/application/commands/set-person-tool-rule.command';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { IntegrationRuntimePort } from '@integrations/application/ports/integration-runtime.port';
import { PersonToolPolicy } from '@integrations/domain/aggregates/person-tool-policy.aggregate';
import type { PersonToolPolicyRepository } from '@integrations/domain/repositories/person-tool-policy.repository';
import { PersonToolRule } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class SetPersonToolRuleHandler
  implements CommandHandlerPort<SetPersonToolRuleCommand, boolean>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly defined: DefinedIntegrationsPort,
    private readonly runtime: IntegrationRuntimePort,
    private readonly policies: PersonToolPolicyRepository,
  ) {}

  async execute(command: SetPersonToolRuleCommand): Promise<boolean> {
    try {
      const viewer = UserId.of(command.viewerId);

      if (!(await this.access.onTeam(command.teamId, viewer))) {
        return false;
      }

      const teamId = TeamId.of(command.teamId);
      const source = SourceKey.of(command.source);
      const tool = ToolName.of(command.tool);
      const rule = PersonToolRule.of(command.rule);
      const definitions = await this.defined.ofTeam(teamId);
      const offered = definitions.some(
        (each) =>
          each.source === source.value && each.offers.includes(tool.value),
      );
      const actsAsEachPerson = this.runtime
        .integrations(definitions)
        .some((each) => each.source.equals(source) && each.holding.byRequester);

      if (!offered || !actsAsEachPerson) {
        return false;
      }

      const policy =
        (await this.policies.of(teamId, viewer, source)) ??
        PersonToolPolicy.none({ teamId, personId: viewer, source });

      await this.policies.save(policy.set(tool, rule));

      return true;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
