import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { RefreshIntegrationSpecCommand } from '@integrations/application/commands/refresh-integration-spec.command';
import type { IntegrationSpecs } from '@integrations/application/services/integration-specs.service';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RefreshIntegrationSpecHandler
  implements CommandHandlerPort<RefreshIntegrationSpecCommand, void>
{
  constructor(
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly specs: IntegrationSpecs,
    private readonly teams: TeamDirectoryPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RefreshIntegrationSpecCommand): Promise<void> {
    const teamId = TeamId.of(command.teamId);
    const existing = await this.definitions.of(
      teamId,
      IntegrationKey.of(command.integration),
    );
    const team = await this.teams.find(teamId);

    if (!existing?.reading || !team) {
      return;
    }

    const { compiled, reading } = await this.specs.compiled({
      definition: existing.document.fields,
      teamId,
      current: existing.reading,
      refreshingSpec: true,
    });

    if (!compiled.ok || !reading || !existing.changesSpec(reading)) {
      return;
    }

    await this.transaction.inTransaction(() =>
      this.definitions.save(
        existing.refreshSpec(
          compiled,
          reading,
          Attribution.spotlight(team.workspaceId),
        ),
      ),
    );
  }
}
