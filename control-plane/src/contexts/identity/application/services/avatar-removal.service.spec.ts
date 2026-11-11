import {
  OWNER,
  STORED_IMAGE,
  avatarsHolding,
  imagesHolding,
  storedAvatar,
} from '@identity/application/commands/handlers/avatar.fake-spec';
import { AvatarRemoval } from '@identity/application/services/avatar-removal.service';
import type { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import { AvatarRemoved } from '@identity/domain/events/avatar-removed.event';
import { AvatarReplaced } from '@identity/domain/events/avatar-replaced.event';
import type { TeamDeleted } from '@identity/domain/events/team-deleted.event';
import { AvatarVersionConflictError } from '@identity/domain/exceptions/avatar-version-conflict.error';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const OLD = AvatarDigest.of('a'.repeat(64));
const NEW = AvatarDigest.of('b'.repeat(64));
const TEAM = TeamId.of('team_1');

const removal = (found: Avatar | null) => {
  const { avatars, save } = avatarsHolding(found);
  const { images, remove, removeAllOfTeam, removeAllIn } = imagesHolding();

  return {
    service: new AvatarRemoval(avatars, images),
    save,
    remove,
    removeAllOfTeam,
    removeAllIn,
  };
};

describe('AvatarRemoval', () => {
  it('removes the image a replaced avatar showed', async () => {
    const { service, remove } = removal(null);

    await service.previousImageOf(
      new AvatarReplaced(OWNER, NEW, OLD, STORED_IMAGE),
    );

    expect(remove).toHaveBeenCalledWith(OWNER, STORED_IMAGE);
  });

  it('removes the image a removed avatar showed', async () => {
    const { service, remove } = removal(null);

    await service.previousImageOf(new AvatarRemoved(OWNER, OLD, STORED_IMAGE));

    expect(remove).toHaveBeenCalledWith(OWNER, STORED_IMAGE);
  });

  it('removes every image of a deleted team', async () => {
    const { service, removeAllOfTeam } = removal(null);

    await service.imagesOfTeam({
      workspaceId: OWNER.workspaceId,
      teamId: TEAM,
    } as TeamDeleted);

    expect(removeAllOfTeam).toHaveBeenCalledWith(OWNER.workspaceId, TEAM);
  });

  it('removes the avatars of a deleted workspace', async () => {
    const { service, save } = removal(storedAvatar(OLD));

    await service.ofWorkspace({ workspaceId: OWNER.workspaceId } as never);

    expect(save.mock.calls[0]?.[0].isRemoved).toBe(true);
  });

  it('removes every image of a deleted workspace', async () => {
    const { service, removeAllIn } = removal(null);

    await service.imagesOfWorkspace({
      workspaceId: OWNER.workspaceId,
    } as never);

    expect(removeAllIn).toHaveBeenCalledWith(OWNER.workspaceId);
  });

  it('leaves an avatar that changed meanwhile to its next change', async () => {
    const { service, save } = removal(storedAvatar(OLD));
    save.mockRejectedValueOnce(
      new AvatarVersionConflictError('workspace ws_1'),
    );

    await expect(
      service.ofWorkspace({ workspaceId: OWNER.workspaceId } as never),
    ).resolves.toBeUndefined();
  });
});
