import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { DefineIntegrationCommand } from '@integrations/application/commands/define-integration.command';
import type { DefinedIntegrationDto } from '@integrations/application/dto/integration-resource.dto';
import type { IntegrationCompilerPort } from '@integrations/application/ports/integration-compiler.port';
import { IntegrationDefinition } from '@integrations/domain/aggregates/integration-definition.aggregate';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class DefineIntegrationHandler
  implements
    CommandHandlerPort<DefineIntegrationCommand, DefinedIntegrationDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly compiler: IntegrationCompilerPort,
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(
    command: DefineIntegrationCommand,
  ): Promise<DefinedIntegrationDto | null> {
    try {
      const membership = await this.access.onTeam(
        command.teamId,
        UserId.of(command.requesterId),
      );

      if (!membership?.administers) {
        return null;
      }

      const compiled = this.compiler.compile(command.definition);

      if (!compiled.ok) {
        return compiled;
      }

      const teamId = TeamId.of(command.teamId);
      const defined = await this.transaction.run(async () => {
        const standing = await this.definitions.of(
          teamId,
          compiled.integration.source,
        );
        const next = standing
          ? standing.redefinedAs(compiled)
          : IntegrationDefinition.define({ ...compiled, teamId });

        await this.definitions.save(next);

        return next;
      });

      return {
        ok: true,
        integration: {
          source: defined.source.value,
          definition: defined.document.fields,
        },
        warnings: compiled.warnings,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
