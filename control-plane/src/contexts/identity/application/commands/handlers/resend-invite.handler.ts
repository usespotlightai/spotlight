import type { ResendInviteCommand } from '@identity/application/commands/resend-invite.command';
import type { WorkspaceInviteDto } from '@identity/application/dto/invite.dto';
import type { InviteSending } from '@identity/application/services/invite-sending.service';
import type { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class ResendInviteHandler
  implements CommandHandlerPort<ResendInviteCommand, WorkspaceInviteDto | null>
{
  constructor(
    private readonly administration: WorkspaceAdministration,
    private readonly invites: WorkspaceInviteRepository,
    private readonly teams: TeamRepository,
    private readonly sending: InviteSending,
    private readonly tokens: TokenMintPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: ResendInviteCommand,
  ): Promise<WorkspaceInviteDto | null> {
    try {
      const administered = await this.administration.administeredBy(
        command.slug,
        command.viewerId,
      );

      if (!administered) {
        return null;
      }

      const { workspace, by } = administered;
      const sender = await this.sending.sender(by);
      const invite = await this.invites.find(InviteId.of(command.inviteId));

      if (!sender || !invite?.workspaceId.equals(workspace.id)) {
        return null;
      }

      const joining = (await this.teams.ofWorkspace(workspace.id)).filter(
        (team) => invite.terms.joins(team.id),
      );
      const minted = this.tokens.mint();
      const again = invite.sentAgain({
        terms: workspace.inviteTerms({
          role: invite.terms.role,
          teams: joining.map((team) => team.id),
          among: joining,
        }),
        tokenHash: TokenHash.of(minted.hash),
        by,
        now: this.clock.now(),
      });

      await this.invites.save(again);
      await this.sending.send(again, minted.token, {
        workspace,
        teams: joining,
        by: sender,
      });

      return {
        id: again.id.value,
        email: again.email.value,
        role: again.terms.invitedAs,
        teams: joining.map((team) => ({
          id: team.id.value,
          name: team.name.value,
        })),
        invitedBy: sender,
        invitedAt: again.invitedAt.toISOString(),
        expiresAt: again.expiresAt.toISOString(),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
