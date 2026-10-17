import {
  type InviteToWorkspaceCommand,
  MAX_INVITED_AT_ONCE,
} from '@identity/application/commands/invite-to-workspace.command';
import type {
  InviteOutcome,
  InviteOutcomeDto,
  InviteOutcomesDto,
} from '@identity/application/dto/invite.dto';
import { InviteeCountError } from '@identity/application/errors/invitee-count.error';
import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type {
  InviteSending,
  InviteSent,
} from '@identity/application/services/invite-sending.service';
import type { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import { AlreadyInvitedError } from '@identity/domain/exceptions/already-invited.error';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { TeamRepository } from '@identity/domain/repositories/team.repository';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';
import { EmailAddress } from '@identity/domain/value-objects/email-address.vo';
import { InviteId } from '@identity/domain/value-objects/invite-id.vo';
import type { InviteTerms } from '@identity/domain/value-objects/invite-terms.vo';
import { WorkspaceRole } from '@identity/domain/value-objects/workspace-role.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TokenMintPort } from '@shared-kernel/application/ports/token-mint.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

interface Asked {
  readonly workspace: Workspace;
  readonly email: EmailAddress;
  readonly terms: InviteTerms;
  readonly by: UserId;
}

interface Written {
  readonly invite: WorkspaceInvite;
  readonly token: string;
  readonly outcome: InviteOutcome;
}

export class InviteToWorkspaceHandler
  implements
    CommandHandlerPort<InviteToWorkspaceCommand, InviteOutcomesDto | null>
{
  constructor(
    private readonly administration: WorkspaceAdministration,
    private readonly invites: WorkspaceInviteRepository,
    private readonly teams: TeamRepository,
    private readonly members: MemberDirectoryPort,
    private readonly sending: InviteSending,
    private readonly tokens: TokenMintPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: InviteToWorkspaceCommand,
  ): Promise<InviteOutcomesDto | null> {
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

      if (!sender) {
        return null;
      }

      const held = await this.teams.ofWorkspace(workspace.id);
      const terms = workspace.inviteTerms({
        role: WorkspaceRole.of(command.role),
        teams: command.teamIds.map((teamId) => TeamId.of(teamId)),
        among: held,
      });
      const joining = held.filter((team) => terms.joins(team.id));
      const emails = distinct(command.emails.map(EmailAddress.of));

      if (emails.length === 0 || emails.length > MAX_INVITED_AT_ONCE) {
        throw new InviteeCountError(emails.length);
      }

      const outcomes: InviteOutcomeDto[] = [];

      for (const email of emails) {
        outcomes.push(
          await this.invited(
            { workspace, email, terms, by },
            { workspace, teams: joining, by: sender },
          ),
        );
      }

      return { outcomes };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async invited(
    asked: Asked,
    into: InviteSent,
  ): Promise<InviteOutcomeDto> {
    const email = asked.email.value;

    if (await this.members.byEmail(asked.workspace.id, email)) {
      return { email, outcome: 'already-a-member' };
    }

    const written = await this.written(asked).catch((error: unknown) => {
      if (
        error instanceof InviteVersionConflictError ||
        error instanceof AlreadyInvitedError
      ) {
        return this.written(asked);
      }
      throw error;
    });

    if (!(await this.sending.sent(written.invite, written.token, into))) {
      return { email, outcome: 'not-sent' };
    }

    return { email, outcome: written.outcome };
  }

  private async written(asked: Asked): Promise<Written> {
    const minted = this.tokens.mint();
    const { invite, again } = WorkspaceInvite.offerTo(
      await this.invites.openTo(asked.workspace.id, asked.email),
      {
        id: InviteId.of(this.ids.generate()),
        workspaceId: asked.workspace.id,
        email: asked.email,
        terms: asked.terms,
        tokenHash: TokenHash.of(minted.hash),
        invitedBy: asked.by,
        now: this.clock.now(),
      },
    );

    if (again) {
      await this.invites.save(invite);
    } else {
      await this.invites.add(invite);
    }

    return {
      invite,
      token: minted.token,
      outcome: again ? 'sent-again' : 'invited',
    };
  }
}

const distinct = (emails: readonly EmailAddress[]): readonly EmailAddress[] =>
  emails.filter(
    (email, at) => emails.findIndex((each) => each.equals(email)) === at,
  );
