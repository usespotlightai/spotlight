import type { AvatarImageDto } from '@identity/application/dto/avatar-image.dto';
import type { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import type { AvatarImage } from '@identity/domain/value-objects/avatar-image.vo';
import type { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const AVATAR_IMAGES = Symbol('AVATAR_IMAGES');

export interface AvatarImagesPort {
  put(owner: AvatarOwner, id: AvatarImageId, image: AvatarImage): Promise<void>;

  read(owner: AvatarOwner, id: AvatarImageId): Promise<AvatarImageDto | null>;

  remove(owner: AvatarOwner, id: AvatarImageId): Promise<void>;

  removeAllOfTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void>;

  removeAllIn(workspaceId: WorkspaceId): Promise<void>;
}
