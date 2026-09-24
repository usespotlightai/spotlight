import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import { IntegrationProblems } from '@integrations/application/rendering/integration-problems';
import type { ToolsGiven } from '@integrations/application/services/tools-given.service';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import { IntegrationHostFixedError } from '@integrations/domain/exceptions/integration-host-fixed.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import {
  FORBIDDEN,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';

export class UpdateIntegrationHandler
  implements
    CommandHandlerPort<UpdateIntegrationCommand, ResourceUpdated | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly compiler: IntegrationCompilerPort,
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly given: ToolsGiven,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: UpdateIntegrationCommand,
  ): Promise<ResourceUpdated | null> {
    const id = IntegrationDefinitionId.of(command.integrationId);

    try {
      const standing = await this.definitions.withId(id);
      const cleared = standing
        ? await this.access.clearanceOnTeam(
            standing.teamId.value,
            command.actor.principal,
          )
        : null;

      if (!standing || !cleared) {
        return null;
      }

      if (!cleared.configures) {
        return FORBIDDEN;
      }

      standing.expecting(command.expectedVersion);

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const given = await this.given.onTeam(standing.teamId);

      await this.transaction.run(() =>
        this.definitions.save(
          standing.redefinedAs(
            compiled,
            given,
            Attribution.of(command.actor, cleared.workspaceId),
          ),
        ),
      );

      return { outcome: 'updated', id: id.value };
    } catch (error) {
      if (error instanceof IntegrationDefinitionMovedOnError) {
        const current = await this.definitions.withId(id);

        return current
          ? { outcome: 'moved-on', currentVersion: current.version }
          : null;
      }

      if (error instanceof IntegrationHostFixedError) {
        return {
          outcome: 'invalid',
          problems: [IntegrationProblems.hostFixed(error)],
        };
      }

      if (error instanceof IntegrationToolsInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
