import type { AcceptInviteCommand } from '@application/commands/accept-invite.command';
import type { JoinedTeamDto } from '@application/dto/invite.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { TokenMintPort } from '@application/ports/token-mint.port';
import type { InviteRepository } from '@domain/repositories/invite.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import type { WorkspaceRepository } from '@domain/repositories/workspace.repository';
import { EmailAddress } from '@domain/value-objects/email-address.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceRole } from '@domain/value-objects/workspace-role.vo';

export class AcceptInviteHandler
  implements CommandHandlerPort<AcceptInviteCommand, JoinedTeamDto | null>
{
  constructor(
    private readonly invites: InviteRepository,
    private readonly teams: TeamRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly tokens: TokenMintPort,
    private readonly events: DomainEventDispatcher,
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

      const joinedWorkspace = workspace.joinedBy(who, WorkspaceRole.member);
      await this.workspaces.save(joinedWorkspace);

      const joinedTeam = team.joinedBy(who, invite.role);
      await this.teams.save(joinedTeam);

      await this.invites.save(accepted);

      await this.events.dispatch([
        ...joinedWorkspace.pullEvents(),
        ...joinedTeam.pullEvents(),
        ...accepted.pullEvents(),
      ]);

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
