import type { RevealVaultKeyCommand } from '@application/commands/reveal-vault-key.command';
import type { VaultKeyDto } from '@application/dto/configuration.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import type { TeamVault } from '@application/services/team-vault.service';
import { NotYoursToRevealVaultKeyError } from '@domain/exceptions/not-yours-to-reveal-vault-key.error';
import { TeamId } from '@domain/value-objects/team-id.vo';

export class RevealVaultKeyHandler
  implements CommandHandlerPort<RevealVaultKeyCommand, VaultKeyDto | null>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly vault: TeamVault,
  ) {}

  async execute(command: RevealVaultKeyCommand): Promise<VaultKeyDto | null> {
    try {
      const member = await this.authorization.memberOf(
        command.teamId,
        command.viewerId,
      );

      if (!member) {
        return null;
      }
      if (!member.workspace.mayRevealVaultKeyBy(member.by)) {
        throw new NotYoursToRevealVaultKeyError();
      }

      const key = await this.vault.revealKey(TeamId.of(command.teamId));

      return { key: key.value };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
