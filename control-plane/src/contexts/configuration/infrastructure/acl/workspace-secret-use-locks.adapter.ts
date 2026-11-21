import type { SecretUseLocksPort } from '@configuration/application/ports/secret-use-locks.port';
import type { TeamDirectoryPort } from '@identity/application/ports/team-directory.port';
import type { SecretUseLocksPort as SecretsSecretUseLocksPort } from '@secrets/application/ports/secret-use-locks.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class WorkspaceSecretUseLocks implements SecretUseLocksPort {
  constructor(
    private readonly teams: TeamDirectoryPort,
    private readonly locks: SecretsSecretUseLocksPort,
  ) {}

  async lock(teamId: TeamId): Promise<void> {
    const team = await this.teams.find(teamId);

    if (team) {
      await this.locks.lock(team.workspaceId);
    }
  }
}
