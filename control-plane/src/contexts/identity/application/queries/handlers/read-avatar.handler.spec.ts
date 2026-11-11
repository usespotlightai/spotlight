import {
  OWNER,
  STORED_IMAGE,
  avatarsHolding,
  imagesHolding,
  ownersWith,
  storedAvatar,
} from '@identity/application/commands/handlers/avatar.fake-spec';
import { ReadAvatarHandler } from '@identity/application/queries/handlers/read-avatar.handler';
import { ReadAvatarQuery } from '@identity/application/queries/read-avatar.query';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import { describe, expect, it } from 'vitest';

const SHOWN = 'a'.repeat(64);

const reading = (access: 'none' | 'member' | 'admin' = 'member') => {
  const { avatars } = avatarsHolding(storedAvatar(AvatarDigest.of(SHOWN)));
  const { images, read } = imagesHolding();

  return {
    handler: new ReadAvatarHandler(ownersWith(access), avatars, images),
    read,
  };
};

const query = (digest: string) =>
  new ReadAvatarQuery({ kind: 'workspace', slug: 'acme' }, digest, 'user_1');

describe('ReadAvatarHandler', () => {
  it('gives a member the image the avatar shows', async () => {
    const { handler, read } = reading();

    await expect(handler.execute(query(SHOWN))).resolves.toEqual({
      bytes: new Uint8Array([1]),
      contentType: 'image/png',
    });
    expect(read).toHaveBeenCalledWith(OWNER, STORED_IMAGE);
  });

  it('finds no image the avatar no longer shows', async () => {
    const { handler, read } = reading();

    await expect(handler.execute(query('b'.repeat(64)))).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('finds nothing for a digest that is not one', async () => {
    const { handler, read } = reading();

    await expect(handler.execute(query('../secret'))).resolves.toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('finds nothing for somebody outside the workspace', async () => {
    await expect(
      reading('none').handler.execute(query(SHOWN)),
    ).resolves.toBeNull();
  });
});
