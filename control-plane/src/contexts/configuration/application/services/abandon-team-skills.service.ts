import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class AbandonTeamSkills {
  constructor(
    private readonly definitions: SkillDefinitionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async of(teamId: TeamId, workspaceId: WorkspaceId): Promise<void> {
    const by = Attribution.spotlight(workspaceId);

    for (const skill of await this.definitions.ofTeam(teamId)) {
      await this.transaction.run(() =>
        this.definitions.save(skill.abandoned(by)),
      );
    }
  }
}
