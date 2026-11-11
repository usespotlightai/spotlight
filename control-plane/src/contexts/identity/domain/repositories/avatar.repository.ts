import type { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import type { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface AvatarRepository {
  find(owner: AvatarOwner): Promise<Avatar | null>;

  ofWorkspace(workspaceId: WorkspaceId): Promise<readonly Avatar[]>;

  add(avatar: Avatar): Promise<void>;

  save(avatar: Avatar): Promise<void>;
}
