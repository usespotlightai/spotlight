import type { ResendInviteCommand } from '@identity/application/commands/resend-invite.command';
import type { WorkspaceInviteDto } from '@identity/application/dto/invite.dto';
import type { InviteSending } from '@identity/application/services/invite-sending.service';
import type { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';

export class ResendInviteHandler
  implements CommandHandlerPort<ResendInviteCommand, WorkspaceInviteDto | null>
{
  constructor(
    private readonly administration: WorkspaceAdministration,
    private readonly invites: WorkspaceInviteRepository,
    private readonly teams: TeamRepository,
    private readonly sending: InviteSending,
    private readonly tokens: TokenIssuer,
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
      const newToken = this.tokens.issue();
      const resent = invite.resend({
        terms: workspace.inviteTerms({
          role: invite.terms.role,
          teams: joining.map((team) => team.id),
          among: joining,
        }),
        tokenHash: TokenHash.of(newToken.hash),
        by,
        now: this.clock.now(),
      });

      await this.invites.save(resent);
      await this.sending.send(resent, newToken.token, {
        workspace,
        teams: joining,
        by: sender,
      });

      return {
        id: resent.id.value,
        email: resent.email.value,
        role: resent.terms.invitedAs,
        teams: joining.map((team) => ({
          id: team.id.value,
          name: team.name.value,
        })),
        invitedBy: sender,
        invitedAt: resent.invitedAt.toISOString(),
        expiresAt: resent.expiresAt.toISOString(),
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
