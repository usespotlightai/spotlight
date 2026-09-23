import type { IntegrationDefinitionRepository } from '@integrations/domain/repositories/integration-definition.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class AbandonTeamIntegrations {
  constructor(
    private readonly definitions: IntegrationDefinitionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async of(teamId: TeamId): Promise<void> {
    for (const integration of await this.definitions.ofTeam(teamId)) {
      await this.transaction.run(() =>
        this.definitions.save(integration.abandoned()),
      );
    }
  }
}
