import { RemoveAvatarCommand } from '@identity/application/commands/avatar.commands';
import {
  avatarsHolding,
  ownersWith,
  storedAvatar,
} from '@identity/application/commands/handlers/avatar.fake-spec';
import { RemoveAvatarHandler } from '@identity/application/commands/handlers/remove-avatar.handler';
import type { Avatar } from '@identity/domain/aggregates/avatar.aggregate';
import { AvatarDigest } from '@identity/domain/value-objects/avatar-digest.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { describe, expect, it } from 'vitest';

const transaction: TransactionPort = { inTransaction: (work) => work() };

const stored = storedAvatar(AvatarDigest.of('a'.repeat(64)));

const removing = (
  access: 'none' | 'member' | 'admin',
  found: Avatar | null = stored,
) => {
  const { avatars, save } = avatarsHolding(found);

  return {
    handler: new RemoveAvatarHandler(ownersWith(access), avatars, transaction),
    save,
  };
};

const remove = new RemoveAvatarCommand(
  { kind: 'team', teamId: 'team_1' },
  actorFor(),
);

describe('RemoveAvatarHandler', () => {
  it('removes the avatar', async () => {
    const { handler, save } = removing('admin');

    await expect(handler.execute(remove)).resolves.toEqual({
      outcome: 'deleted',
    });
    expect(save.mock.calls[0]?.[0].isRemoved).toBe(true);
  });

  it('answers deleted when there is no avatar', async () => {
    const { handler, save } = removing('admin', null);

    await expect(handler.execute(remove)).resolves.toEqual({
      outcome: 'deleted',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('forbids somebody who cannot configure the workspace', async () => {
    const { handler, save } = removing('member');

    await expect(handler.execute(remove)).resolves.toEqual({
      outcome: 'forbidden',
      act: 'configure',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('finds nothing for somebody outside the workspace', async () => {
    await expect(removing('none').handler.execute(remove)).resolves.toBeNull();
  });
});
