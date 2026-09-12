import type { InviteToTeamCommand } from '@application/commands/invite-to-team.command';
import type { InviteDto } from '@application/dto/invite.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { InviteMailPort } from '@application/ports/invite-mail.port';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { PersonReaderPort } from '@application/ports/person-reader.port';
import type { TokenMintPort } from '@application/ports/token-mint.port';
import type { ConnectionAuthorization } from '@application/services/connection-authorization.service';
import { Invite } from '@domain/aggregates/invite.aggregate';
import { AlreadyOnTheTeamError } from '@domain/exceptions/already-on-the-team.error';
import type { InviteRepository } from '@domain/repositories/invite.repository';
import type { TeamRepository } from '@domain/repositories/team.repository';
import { EmailAddress } from '@domain/value-objects/email-address.vo';
import { InviteId } from '@domain/value-objects/invite-id.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { UserId } from '@domain/value-objects/user-id.vo';

export class InviteToTeamHandler
  implements CommandHandlerPort<InviteToTeamCommand, InviteDto | null>
{
  constructor(
    private readonly authorization: ConnectionAuthorization,
    private readonly teams: TeamRepository,
    private readonly invites: InviteRepository,
    private readonly members: MemberReaderPort,
    private readonly people: PersonReaderPort,
    private readonly tokens: TokenMintPort,
    private readonly mail: InviteMailPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly events: DomainEventDispatcher,
  ) {}

  async execute(command: InviteToTeamCommand): Promise<InviteDto | null> {
    try {
      const workspace = await this.authorization.connectableBy(
        command.teamId,
        command.viewerId,
      );

      if (!workspace) {
        return null;
      }

      const teamId = TeamId.of(command.teamId);
      const team = await this.teams.find(teamId);

      if (!team) {
        return null;
      }

      const email = EmailAddress.of(command.email);

      if (await this.members.onTeam(teamId, email.value)) {
        throw new AlreadyOnTheTeamError(email.value);
      }

      const invitedBy = UserId.of(command.viewerId);
      const minted = this.tokens.mint();
      const now = this.clock.now();

      const standing = await this.invites.to(teamId, email);
      const invite = standing
        ? standing.sentAgain(TokenHash.of(minted.hash), invitedBy, now)
        : Invite.offer({
            id: InviteId.of(this.ids.generate()),
            team,
            email,
            tokenHash: TokenHash.of(minted.hash),
            invitedBy,
            now,
          });

      await (standing ? this.invites.save(invite) : this.invites.add(invite));

      await this.events.dispatch(invite.pullEvents());

      const asker = await this.people.find(invitedBy);

      await this.mail.send({
        to: invite.email.value,
        token: minted.token,
        teamName: team.name.value,
        workspaceName: workspace.name.value,
        invitedBy: asker?.name || 'Somebody',
      });

      return {
        id: invite.id.value,
        email: invite.email.value,
        invitedBy: asker?.name ?? '',
        invitedAt: invite.invitedAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
