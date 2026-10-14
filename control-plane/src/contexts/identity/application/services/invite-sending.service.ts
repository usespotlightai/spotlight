import type { InviteMailPort } from '@identity/application/ports/invite-mail.port';
import type {
  PersonReaderPort,
  PersonSummary,
} from '@identity/application/ports/person-reader.port';
import type { Team } from '@identity/domain/aggregates/team.aggregate';
import type { Workspace } from '@identity/domain/aggregates/workspace.aggregate';
import type { WorkspaceInvite } from '@identity/domain/aggregates/workspace-invite.aggregate';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface InviteSent {
  readonly workspace: Workspace;
  readonly teams: readonly Team[];
  readonly by: PersonSummary;
}

export class InviteSending {
  constructor(
    private readonly people: PersonReaderPort,
    private readonly mail: InviteMailPort,
    private readonly logger: LoggerPort,
  ) {}

  async sender(by: UserId): Promise<PersonSummary | null> {
    return this.people.find(by);
  }

  async send(
    invite: WorkspaceInvite,
    token: string,
    into: InviteSent,
  ): Promise<void> {
    await this.mail.send({
      to: invite.email.value,
      token,
      workspaceName: into.workspace.name.value,
      teamNames: into.teams
        .filter((team) => invite.terms.joins(team.id))
        .map((team) => team.name.value),
      invitedBy: into.by.name,
    });
  }

  async sent(
    invite: WorkspaceInvite,
    token: string,
    into: InviteSent,
  ): Promise<boolean> {
    try {
      await this.send(invite, token, into);
      return true;
    } catch (error) {
      this.logger.warn(
        { err: error, inviteId: invite.id.value },
        'Could not send an invite',
      );
      return false;
    }
  }
}
