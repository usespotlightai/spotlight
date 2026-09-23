import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { UpdateIntegrationCommand } from '@integrations/application/commands/update-integration.command';
import type { IntegrationUpdatedDto } from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import type { ToolsGiven } from '@integrations/application/services/tools-given.service';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import { IntegrationHostFixedError } from '@integrations/domain/exceptions/integration-host-fixed.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class UpdateIntegrationHandler
  implements
    CommandHandlerPort<UpdateIntegrationCommand, IntegrationUpdatedDto | null>
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
  ): Promise<IntegrationUpdatedDto | null> {
    const id = IntegrationDefinitionId.of(command.integrationId);

    try {
      const standing = await this.definitions.withId(id);
      const membership = standing
        ? await this.access.onTeam(
            standing.teamId.value,
            UserId.of(command.requesterId),
          )
        : null;

      if (!standing || !membership?.administers) {
        return null;
      }

      standing.expecting(command.expectedVersion);

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return { outcome: 'invalid', problems: compiled.problems };
      }

      const given = await this.given.onTeam(standing.teamId);

      await this.transaction.run(() =>
        this.definitions.save(standing.redefinedAs(compiled, given)),
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
          problems: [
            ConfigurationProblem.of({
              path: `integrations/${error.source}`,
              at: error.field,
              reason: error.because,
            }),
          ],
        };
      }

      if (error instanceof IntegrationToolsInUseError) {
        return { outcome: 'in-use', reason: error.message };
      }

      rethrowAsFault(error);
    }
  }
}
