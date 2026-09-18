import type { RevealVaultKeyCommand } from '@configuration/application/commands/reveal-vault-key.command';
import type { VaultKeyDto } from '@configuration/application/dto/configuration.dto';
import type { TeamsPort } from '@configuration/application/ports/teams.port';
import type { TeamVault } from '@configuration/application/services/team-vault.service';
import { mayRevealVaultKey } from '@configuration/domain/services/secret-sealing-policy';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class RevealVaultKeyHandler
  implements CommandHandlerPort<RevealVaultKeyCommand, VaultKeyDto | null>
{
  constructor(
    private readonly teams: TeamsPort,
    private readonly vault: TeamVault,
  ) {}

  async execute(command: RevealVaultKeyCommand): Promise<VaultKeyDto | null> {
    try {
      const team = await this.teams.viewedBy(
        command.teamId,
        UserId.of(command.viewerId),
      );

      if (!team) {
        return null;
      }

      mayRevealVaultKey(team);

      const key = await this.vault.revealKey(team.teamId);

      return { key: key.value };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
