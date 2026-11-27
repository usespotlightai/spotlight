import type { AvatarImagesPort } from '@identity/application/ports/avatar-images.port';
import type {
  AvatarOwners,
  OwnedAvatar,
} from '@identity/application/services/avatar-owners.service';
import { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import type { AvatarRepository } from '@identity/domain/repositories/avatar.repository';
import type { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { AvatarImageId } from '@identity/domain/value-objects/avatar-image-id.vo';
import { AvatarOwner } from '@identity/domain/value-objects/avatar-owner.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { type Mock, vi } from 'vitest';

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
  partial<AvatarOwners>({
    of: async () =>
      access === 'none'
        ? null
        : partial<OwnedAvatar>({
            owner: OWNER,
            permissions: partial<OwnedAvatar['permissions']>({
              configures: access === 'admin',
            }),
          }),
  });

interface AvatarsHolding {
  readonly avatars: AvatarRepository;
  readonly add: Mock<(avatar: Avatar) => Promise<void>>;
  readonly save: Mock<(avatar: Avatar) => Promise<void>>;
}

interface ImagesHolding {
  readonly images: AvatarImagesPort;
  readonly put: Mock<AvatarImagesPort['put']>;
  readonly read: Mock<AvatarImagesPort['read']>;
  readonly remove: Mock<AvatarImagesPort['remove']>;
  readonly removeAllOfTeam: Mock<AvatarImagesPort['removeAllOfTeam']>;
  readonly removeAllIn: Mock<AvatarImagesPort['removeAllIn']>;
}

export const avatarsHolding = (found: Avatar | null = null): AvatarsHolding => {
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

export const imagesHolding = (): ImagesHolding => {
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
