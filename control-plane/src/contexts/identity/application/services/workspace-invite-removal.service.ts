import type { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import { InviteVersionConflictError } from '@identity/domain/exceptions/invite-version-conflict.error';
import type { WorkspaceInviteRepository } from '@identity/domain/repositories/workspace-invite.repository';

export const REMOVE_INVITES_OF_DELETED_WORKSPACE =
  'identity.remove-invites-of-deleted-workspace';

export class WorkspaceInviteRemoval {
  constructor(private readonly invites: WorkspaceInviteRepository) {}

  async removeOf(deleted: WorkspaceDeleted): Promise<void> {
    for (const invite of await this.invites.ofWorkspace(deleted.workspaceId)) {
      try {
        await this.invites.remove(
          invite.removedWithWorkspace(deleted.workspaceId),
        );
      } catch (error) {
        if (!(error instanceof InviteVersionConflictError)) {
          throw error;
        }
      }
    }
  }
}
