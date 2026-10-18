import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class DeleteTeamSkills {
  constructor(
    private readonly definitions: SkillDefinitionRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async deleteForTeam(teamId: TeamId, workspaceId: WorkspaceId): Promise<void> {
    const by = ChangeActor.spotlight(workspaceId);

    for (const skill of await this.definitions.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.definitions.save(skill.cascadeDelete(by)),
      );
    }
  }
}
