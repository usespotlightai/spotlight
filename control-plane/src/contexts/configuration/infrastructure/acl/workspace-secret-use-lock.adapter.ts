import type { SecretUseLockPort } from '@configuration/application/ports/secret-use-lock.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { SecretUseLocksPort } from '@secrets/application/ports/secret-use-locks.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class WorkspaceSecretUseLock implements SecretUseLockPort {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly locks: SecretUseLocksPort,
  ) {}

  async lockUsesBy(teamId: TeamId): Promise<void> {
    const team = await this.teams.find(teamId);

    if (team) {
      await this.locks.lockUsesIn(team.workspaceId);
    }
  }
}
