import { SetAvatarCommand } from '@identity/application/commands/avatar.commands';
import {
  NEW_IMAGE,
  OWNER,
  avatarsHolding,
  imagesHolding,
  ownersWith,
  storedAvatar,
} from '@identity/application/commands/handlers/avatar.fake-spec';
import { SetAvatarHandler } from '@identity/application/commands/handlers/set-avatar.handler';
import type { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import { AvatarVersionConflictError } from '@identity/domain/exceptions/avatar-version-conflict.error';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { describe, expect, it } from 'vitest';

const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0);
const DIGEST = 'c'.repeat(64);
const transaction: TransactionPort = { inTransaction: (work) => work() };

const setting = (
  access: 'none' | 'member' | 'admin',
  found: Avatar | null = null,
) => {
  const { avatars, add, save } = avatarsHolding(found);
  const { images, put, remove } = imagesHolding();
  const handler = new SetAvatarHandler(
    ownersWith(access),
    avatars,
    images,
    { sha256: () => DIGEST },
    { generate: () => NEW_IMAGE.value },
    transaction,
  );

  return { handler, add, save, put, remove };
};

const set = (bytes = PNG, contentType = 'image/png') =>
  new SetAvatarCommand(
    { kind: 'workspace', slug: 'acme' },
    { bytes, contentType },
    actorFor(),
  );

describe('SetAvatarHandler', () => {
  it('stores the image under a new id, then adds the avatar', async () => {
    const { handler, add, save, put } = setting('admin');

    await expect(handler.execute(set())).resolves.toEqual({
      outcome: 'set',
      digest: DIGEST,
    });

    expect(put).toHaveBeenCalledWith(OWNER, NEW_IMAGE, expect.anything());
    const added = add.mock.calls[0]?.[0];
    expect(added?.shows(AvatarDigest.of(DIGEST))).toBe(true);
    expect(added?.image).toEqual(NEW_IMAGE);
    expect(added?.pullEvents().map((each) => each.kind)).toEqual([
      'avatar.set',
    ]);
    expect(save).not.toHaveBeenCalled();
    expect(put.mock.invocationCallOrder[0]).toBeLessThan(
      add.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('replaces the avatar that is there', async () => {
    const { handler, add, save } = setting(
      'admin',
      storedAvatar(AvatarDigest.of('a'.repeat(64)), 2),
    );

    await handler.execute(set());

    expect(add).not.toHaveBeenCalled();
    expect(
      save.mock.calls[0]?.[0].pullEvents().map((each) => each.kind),
    ).toEqual(['avatar.replaced']);
  });

  it('writes nothing when the image is the one shown', async () => {
    const { handler, add, save, put } = setting(
      'admin',
      storedAvatar(AvatarDigest.of(DIGEST), 2),
    );

    await expect(handler.execute(set())).resolves.toEqual({
      outcome: 'set',
      digest: DIGEST,
    });
    expect(put).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('removes the image it stored when the avatar changed meanwhile', async () => {
    const { handler, add, remove } = setting('admin');
    add.mockRejectedValueOnce(new AvatarVersionConflictError('workspace ws_1'));

    await expect(handler.execute(set())).rejects.toThrow('workspace ws_1');
    expect(remove).toHaveBeenCalledWith(OWNER, NEW_IMAGE);
  });

  it('forbids somebody who cannot configure the workspace', async () => {
    const { handler, put } = setting('member');

    await expect(handler.execute(set())).resolves.toEqual({
      outcome: 'forbidden',
      act: 'configure',
    });
    expect(put).not.toHaveBeenCalled();
  });

  it('finds nothing for somebody outside the workspace', async () => {
    await expect(setting('none').handler.execute(set())).resolves.toBeNull();
  });

  it('refuses bytes that are not the image they claim to be', async () => {
    const { handler, put } = setting('admin');

    await expect(handler.execute(set(PNG, 'image/gif'))).rejects.toThrow(
      'is not an image of type image/gif',
    );
    expect(put).not.toHaveBeenCalled();
  });
});
