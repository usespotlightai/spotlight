import type { MemberLookupPort } from '@identity/application/ports/member-lookup.port';
import type {
  MemberMailKind,
  MemberMailPort,
} from '@identity/application/ports/member-mail.port';
import type { PersonReaderPort } from '@identity/application/ports/person-reader.port';
import type { WorkspaceMemberLeft } from '@identity/domain/events/workspace-member-left.event';
import type { WorkspaceMemberSuspended } from '@identity/domain/events/workspace-member-suspended.event';
import type { WorkspaceMemberUnsuspended } from '@identity/domain/events/workspace-member-unsuspended.event';
import type { WorkspaceRepository } from '@identity/domain/repositories/workspace.repository';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MAIL_SUSPENDED_MEMBER = 'identity.mail-suspended-member';

export const MAIL_UNSUSPENDED_MEMBER = 'identity.mail-unsuspended-member';

export const MAIL_MEMBER_WHO_LEFT = 'identity.mail-member-who-left';

export class MemberNotices {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly directory: MemberLookupPort,
    private readonly people: PersonReaderPort,
    private readonly mail: MemberMailPort,
    private readonly logger: LoggerPort,
  ) {}

  suspended(event: WorkspaceMemberSuspended): Promise<void> {
    return this.notify('suspended', event.workspaceId, event.userId, event.by);
  }

  unsuspended(event: WorkspaceMemberUnsuspended): Promise<void> {
    return this.notify(
      'unsuspended',
      event.workspaceId,
      event.userId,
      event.by,
    );
  }

  left(event: WorkspaceMemberLeft): Promise<void> {
    return this.notify('left', event.workspaceId, event.userId, null);
  }

  private async notify(
    kind: MemberMailKind,
    workspaceId: WorkspaceId,
    userId: UserId,
    by: UserId | null,
  ): Promise<void> {
    try {
      const workspace = await this.workspaces.find(workspaceId);
      const [to] = await this.directory.emailsOf(userId);

      if (!workspace || !to) {
        return;
      }

      await this.mail.send({
        kind,
        to,
        workspaceName: workspace.name.value,
        by: by ? ((await this.people.find(by))?.name ?? null) : null,
      });
    } catch (error) {
      this.logger.warn(
        {
          err: error,
          kind,
          workspaceId: workspaceId.value,
          userId: userId.value,
        },
        'Could not send a member notice',
      );
    }
  }
}
