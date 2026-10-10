import type { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import type { JoinedWorkspaceDto } from '@identity/application/dto/invite.dto';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class AcceptInviteHandler
  implements CommandHandlerPort<AcceptInviteCommand, JoinedWorkspaceDto | null>
{
  constructor(
    private readonly invites: WorkspaceInviteRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly tokens: TokenMintPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: AcceptInviteCommand,
  ): Promise<JoinedWorkspaceDto | null> {
    try {
      const invite = await this.invites.withToken(
        TokenHash.of(this.tokens.hash(command.token)),
      );

      if (!invite) {
        return null;
      }

      const accepted = invite.acceptedBySomeone(
        UserId.of(command.viewerId),
        EmailAddress.of(command.viewerEmail),
        this.clock.now(),
      );
      const workspace = await this.workspaces.find(invite.workspaceId);

      if (!workspace) {
        return null;
      }

      await this.invites.save(accepted);

      return { workspaceSlug: workspace.slug.value };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
