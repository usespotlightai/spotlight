import type { InviteToTeamCommand } from '@identity/application/commands/invite-to-team.command';
import type { InviteDto } from '@identity/application/dto/invite.dto';
import type { InviteMailPort } from '@identity/application/ports/invite-mail.port';
import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { TeamAdministration } from '@identity/application/services/team-administration.service';
import { Invite } from '@identity/domain/aggregates/invite.aggregate';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import { AlreadyOnTheTeamError } from '@identity/domain/exceptions/already-on-the-team.error';
import { InviteMovedOnError } from '@identity/domain/exceptions/invite-moved-on.error';
import type { InviteRepository } from '@identity/domain/repositories/invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class InviteToTeamHandler
  implements CommandHandlerPort<InviteToTeamCommand, InviteDto | null>
{
  constructor(
    private readonly authorization: TeamAdministration,
    private readonly invites: InviteRepository,
    private readonly members: MemberReaderPort,
    private readonly people: PersonReaderPort,
    private readonly tokens: TokenMintPort,
    private readonly mail: InviteMailPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: InviteToTeamCommand): Promise<InviteDto | null> {
    try {
      const administered = await this.authorization.administeredBy(
        command.teamId,
        command.viewerId,
      );

      if (!administered) {
        return null;
      }

      const { team, workspace, by: invitedBy } = administered;
      const email = EmailAddress.of(command.email);

      if (await this.members.onTeam(team.id, email.value)) {
        throw new AlreadyOnTheTeamError(email.value);
      }

      const minted = this.tokens.mint();
      const tokenHash = TokenHash.of(minted.hash);
      const id = InviteId.of(this.ids.generate());
      const now = this.clock.now();

      const offered = { team, email, id, tokenHash, invitedBy, now };
      const invite = await this.offered(offered).catch((error: unknown) => {
        if (error instanceof InviteMovedOnError) {
          return this.offered(offered);
        }
        throw error;
      });

      const asker = await this.people.find(invitedBy);

      if (!asker) {
        throw new Error(
          `The inviting person ${invitedBy.value} has no account`,
        );
      }

      await this.mail.send({
        to: invite.email.value,
        token: minted.token,
        teamName: team.name.value,
        workspaceName: workspace.name.value,
        invitedBy: asker.name,
      });

      return {
        id: invite.id.value,
        email: invite.email.value,
        invitedBy: asker.name,
        invitedAt: invite.invitedAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async offered(input: {
    team: Team;
    email: EmailAddress;
    id: InviteId;
    tokenHash: TokenHash;
    invitedBy: UserId;
    now: Date;
  }): Promise<Invite> {
    const { team, email, id, tokenHash, invitedBy, now } = input;
    const previous = await this.invites.to(team.id, email);
    const invite = previous
      ? previous.sentAgain({ freshId: id, tokenHash, by: invitedBy, now })
      : Invite.offer({
          id,
          workspaceId: team.workspaceId,
          teamId: team.id,
          email,
          tokenHash,
          invitedBy,
          now,
        });

    await (invite.isNew ? this.invites.add(invite) : this.invites.save(invite));

    return invite;
  }
}
