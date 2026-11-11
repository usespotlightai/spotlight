import type { AvatarImagesPort } from '@identity/application/ports/avatar-images.port';
import type { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import type { AvatarRemoved } from '@identity/domain/events/avatar-removed.event';
import type { AvatarReplaced } from '@identity/domain/events/avatar-replaced.event';
import type { TeamDeleted } from '@identity/domain/events/team-deleted.event';
import type { WorkspaceDeleted } from '@identity/domain/events/workspace-deleted.event';
import { AvatarVersionConflictError } from '@identity/domain/exceptions/avatar-version-conflict.error';
import type { AvatarRepository } from '@identity/domain/repositories/avatar.repository';
import { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';

export const REMOVE_PREVIOUS_AVATAR_IMAGE =
  'identity.remove-previous-avatar-image';

export const REMOVE_AVATAR_OF_DELETED_TEAM =
  'identity.remove-avatar-of-deleted-team';

export const REMOVE_AVATAR_IMAGES_OF_DELETED_TEAM =
  'identity.remove-avatar-images-of-deleted-team';

export const REMOVE_AVATARS_OF_DELETED_WORKSPACE =
  'identity.remove-avatars-of-deleted-workspace';

export const REMOVE_AVATAR_IMAGES_OF_DELETED_WORKSPACE =
  'identity.remove-avatar-images-of-deleted-workspace';

export class AvatarRemoval {
  constructor(
    private readonly avatars: AvatarRepository,
    private readonly images: AvatarImagesPort,
  ) {}

  previousImageOf(event: AvatarReplaced | AvatarRemoved): Promise<void> {
    return this.images.remove(event.owner, event.previousImage);
  }

  async ofTeam(event: TeamDeleted): Promise<void> {
    const found = await this.avatars.find(
      AvatarOwner.team(event.workspaceId, event.teamId),
    );

    if (found) {
      await this.removed(found);
    }
  }

  async ofWorkspace(event: WorkspaceDeleted): Promise<void> {
    for (const found of await this.avatars.ofWorkspace(event.workspaceId)) {
      await this.removed(found);
    }
  }

  imagesOfTeam(event: TeamDeleted): Promise<void> {
    return this.images.removeAllOfTeam(event.workspaceId, event.teamId);
  }

  imagesOfWorkspace(event: WorkspaceDeleted): Promise<void> {
    return this.images.removeAllIn(event.workspaceId);
  }

  private async removed(found: Avatar): Promise<void> {
    try {
      await this.avatars.save(found.removed());
    } catch (error) {
      if (!(error instanceof AvatarVersionConflictError)) {
        throw error;
      }
    }
  }
}
