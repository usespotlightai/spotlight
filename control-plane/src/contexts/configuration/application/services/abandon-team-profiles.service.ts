import type { HarnessProfileRepository } from '@configuration/domain/repositories/harness-profile.repository';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class AbandonTeamProfiles {
  constructor(
    private readonly profiles: HarnessProfileRepository,
    private readonly transaction: TransactionPort,
  ) {}

  async of(teamId: TeamId, workspaceId: WorkspaceId): Promise<void> {
    const by = Attribution.spotlight(workspaceId);

    for (const profile of await this.profiles.ofTeam(teamId)) {
      await this.transaction.inTransaction(() =>
        this.profiles.save(profile.abandon(by)),
      );
    }
  }
}
