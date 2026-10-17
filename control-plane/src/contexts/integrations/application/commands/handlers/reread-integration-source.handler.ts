import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { RereadIntegrationSourceCommand } from '@integrations/application/commands/reread-integration-source.command';
import type { IntegrationSources } from '@integrations/application/services/integration-sources.service';
import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RereadIntegrationSourceHandler
  implements CommandHandlerPort<RereadIntegrationSourceCommand, void>
{
  constructor(
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly sources: IntegrationSources,
    private readonly teams: TeamDirectoryPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RereadIntegrationSourceCommand): Promise<void> {
    const teamId = TeamId.of(command.teamId);
    const existing = await this.definitions.of(
      teamId,
      SourceKey.of(command.source),
    );
    const team = await this.teams.find(teamId);

    if (!existing?.reading || !team) {
      return;
    }

    const { compiled, reading } = await this.sources.compiled({
      definition: existing.document.fields,
      teamId,
      current: existing.reading,
      rereading: true,
    });

    if (!compiled.ok || !reading || !existing.rereads(reading)) {
      return;
    }

    await this.transaction.inTransaction(() =>
      this.definitions.save(
        existing.reread(
          compiled,
          reading,
          Attribution.spotlight(team.workspaceId),
        ),
      ),
    );
  }
}
