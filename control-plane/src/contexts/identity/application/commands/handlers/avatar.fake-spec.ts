import type { AvatarImagesPort } from '@identity/application/ports/avatar-images.port';
import type { AvatarOwners } from '@identity/application/services/avatar-owners.service';
import { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import type { AvatarRepository } from '@identity/domain/repositories/avatar.repository';
import type { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { vi } from 'vitest';

export const OWNER = AvatarOwner.workspace(WorkspaceId.of('ws_1'));

export const STORED_IMAGE = AvatarImageId.of(
  '6f1d2c3b-4a59-4e8d-9c7b-1a2b3c4d5e6f',
);

export const NEW_IMAGE = AvatarImageId.of(
  '7a2e3d4c-5b6a-4f9e-8d7c-2b3c4d5e6f70',
);

export const storedAvatar = (digest: AvatarDigest, version = 1): Avatar =>
  Avatar.rehydrate({ owner: OWNER, digest, image: STORED_IMAGE, version });

export const ownersWith = (access: 'none' | 'member' | 'admin'): AvatarOwners =>
  ({
    of: async () =>
      access === 'none'
        ? null
        : {
            owner: OWNER,
            permissions: { configures: access === 'admin' },
          },
  }) as unknown as AvatarOwners;

export const avatarsHolding = (found: Avatar | null = null) => {
  const add = vi.fn<(avatar: Avatar) => Promise<void>>(async () => {});
  const save = vi.fn<(avatar: Avatar) => Promise<void>>(async () => {});
  const avatars: AvatarRepository = {
    find: async () => found,
    ofWorkspace: async () => (found ? [found] : []),
    add,
    save,
  };

  return { avatars, add, save };
};

export const imagesHolding = () => {
  const put = vi.fn<AvatarImagesPort['put']>(async () => {});
  const read = vi.fn<AvatarImagesPort['read']>(async () => ({
    bytes: new Uint8Array([1]),
    contentType: 'image/png',
  }));
  const remove = vi.fn<AvatarImagesPort['remove']>(async () => {});
  const removeAllOfTeam = vi.fn<AvatarImagesPort['removeAllOfTeam']>(
    async () => {},
  );
  const removeAllIn = vi.fn<AvatarImagesPort['removeAllIn']>(async () => {});
  const images: AvatarImagesPort = {
    put,
    read,
    remove,
    removeAllOfTeam,
    removeAllIn,
  };

  return { images, put, read, remove, removeAllOfTeam, removeAllIn };
};
