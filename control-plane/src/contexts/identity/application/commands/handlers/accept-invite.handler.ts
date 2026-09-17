import type { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import type { JoinedTeamDto } from '@identity/application/dto/invite.dto';
import type { InviteRepository } from '@identity/domain/repositories/invite.repository';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class AcceptInviteHandler
  implements CommandHandlerPort<AcceptInviteCommand, JoinedTeamDto | null>
{
  constructor(
    private readonly invites: InviteRepository,
    private readonly teams: TeamRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly tokens: TokenMintPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AcceptInviteCommand): Promise<JoinedTeamDto | null> {
    try {
      const invite = await this.invites.withToken(
        TokenHash.of(this.tokens.hash(command.token)),
      );

      if (!invite) {
        return null;
      }

      const who = UserId.of(command.viewerId);
      const accepted = invite.acceptedBySomeone(
        who,
        EmailAddress.of(command.viewerEmail),
        this.clock.now(),
      );

      const [team, workspace] = await Promise.all([
        this.teams.find(invite.teamId),
        this.workspaces.find(invite.workspaceId),
      ]);

      if (!team || !workspace) {
        return null;
      }

      await this.invites.save(accepted);

      return {
        workspaceSlug: workspace.slug.value,
        teamId: team.id.value,
        teamName: team.name.value,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
