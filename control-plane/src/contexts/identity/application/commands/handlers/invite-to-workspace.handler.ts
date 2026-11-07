import type { InviteToWorkspaceCommand } from '@identity/application/commands/invite-to-workspace.command';
import type { InviteOutcomeDto } from '@identity/application/dto/invite.dto';
import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type {
  InviteSending,
  InviteSent,
} from '@identity/application/services/invite-sending.service';
import type { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import {
  type InviteOffer,
  WorkspaceInvite,
} from '@identity/domain/aggregates/workspace-invite.aggregate';
import { AlreadyInvitedError } from '@identity/domain/exceptions/already-invited.error';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import type { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { InviteSpec } from '@identity/domain/value-objects/invite-spec.vo';
import { Invitees } from '@identity/domain/value-objects/invitees.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

interface InviteInput {
  readonly workspace: Workspace;
  readonly email: EmailAddress;
  readonly holder: UserId | null;
  readonly spec: InviteSpec;
  readonly by: UserId;
}

interface Offered {
  readonly offer: InviteOffer;
  readonly token: string;
}

export class InviteToWorkspaceHandler
  implements
    CommandHandlerPort<
      InviteToWorkspaceCommand,
      readonly InviteOutcomeDto[] | null
    >
{
  constructor(
    private readonly administration: WorkspaceAdministration,
    private readonly invites: WorkspaceInviteRepository,
    private readonly teams: TeamRepository,
    private readonly members: MemberDirectoryPort,
    private readonly sending: InviteSending,
    private readonly tokens: TokenIssuer,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: InviteToWorkspaceCommand,
  ): Promise<readonly InviteOutcomeDto[] | null> {
    try {
      const invitees = Invitees.of(command.emails);
      const administered = await this.administration.administeredBy(
        command.slug,
        PersonPrincipal.of(UserId.of(command.viewerId)),
      );

      if (!administered) {
        return null;
      }

      const { workspace, by } = administered;
      const sender = await this.sending.sender(by);

      if (!sender) {
        return null;
      }

      const workspaceTeams = await this.teams.ofWorkspace(workspace.id);
      const spec = workspace.inviteSpec({
        role: WorkspaceRole.of(command.role),
        teams: command.teamIds.map((teamId) => TeamId.of(teamId)),
        among: workspaceTeams,
      });
      const into: InviteSent = {
        workspace,
        teams: workspaceTeams.filter((team) => spec.joins(team.id)),
        by: sender,
      };
      const outcomes: InviteOutcomeDto[] = [];

      for (const email of invitees.addresses) {
        outcomes.push(
          await this.invited(
            {
              workspace,
              email,
              holder: await this.members.byEmail(workspace.id, email.value),
              spec,
              by,
            },
            into,
          ),
        );
      }

      return outcomes;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async invited(
    input: InviteInput,
    into: InviteSent,
  ): Promise<InviteOutcomeDto> {
    const email = input.email.value;
    const { offer, token } = await this.offered(input).catch(
      (error: unknown) => {
        if (
          error instanceof InviteVersionConflictError ||
          error instanceof AlreadyInvitedError
        ) {
          return this.offered(input);
        }
        throw error;
      },
    );

    if (offer.outcome === 'already-a-member') {
      return { email, outcome: offer.outcome };
    }

    if (!(await this.sending.sent(offer.invite, token, into))) {
      return { email, outcome: 'not-sent' };
    }

    return { email, outcome: offer.outcome };
  }

  private async offered(input: InviteInput): Promise<Offered> {
    const newToken = this.tokens.issue();
    const offer = WorkspaceInvite.offer(
      await this.invites.latestTo(input.workspace.id, input.email),
      {
        id: InviteId.of(this.ids.generate()),
        workspace: input.workspace,
        email: input.email,
        holder: input.holder,
        spec: input.spec,
        tokenHash: TokenHash.of(newToken.hash),
        invitedBy: input.by,
        now: this.clock.now(),
      },
    );

    if (offer.outcome === 'resent') {
      await this.invites.save(offer.invite);
    }

    if (offer.outcome === 'invited') {
      await this.invites.add(offer.invite);
    }

    return { offer, token: newToken.token };
  }
}
