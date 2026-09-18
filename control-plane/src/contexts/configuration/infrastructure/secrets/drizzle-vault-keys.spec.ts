import { VaultKey } from '@configuration/domain/value-objects/vault-key.vo';
import { DrizzleVaultKeys } from '@configuration/infrastructure/secrets/drizzle-vault-keys';
import type { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { SecretCipher } from '@platform/secrets/secret.cipher';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

interface Row {
  teamId: string;
  sealedKey: string;
}

const TEAM = TeamId.of('team_1');
const cipher = new SecretCipher(Buffer.alloc(32, 7).toString('base64'));

const keeping = (standing?: Row) => {
  let row: Row | null = standing ?? null;

  const db = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (row ? [row] : []),
        }),
      }),
    }),
    insert: () => ({
      values: (written: Row) => ({
        onConflictDoNothing: async () => {
          row ??= written;
        },
      }),
    }),
  };

  return {
    keys: new DrizzleVaultKeys({ db } as unknown as DrizzleContext, cipher),
    row: () => row,
  };
};

const keyOf = (lookup: Awaited<ReturnType<DrizzleVaultKeys['of']>>) =>
  lookup.kind === 'held' ? lookup.key.value : lookup.kind;

describe('DrizzleVaultKeys', () => {
  it('has no key for a team that never kept one', async () => {
    await expect(keeping().keys.of(TEAM)).resolves.toEqual({ kind: 'none' });
  });

  it('keeps the first key it is given, sealed, and gives that one after', async () => {
    const { keys, row } = keeping();

    expect(keyOf(await keys.keepFirst(TEAM, VaultKey.of('first-key')))).toBe(
      'first-key',
    );
    expect(keyOf(await keys.keepFirst(TEAM, VaultKey.of('second-key')))).toBe(
      'first-key',
    );
    expect(keyOf(await keys.of(TEAM))).toBe('first-key');
    expect(row()?.sealedKey).not.toContain('first-key');
  });

  it('gives the key that was kept, where another request wrote one first', async () => {
    const { keys } = keeping({
      teamId: TEAM.value,
      sealedKey: cipher.seal('theirs'),
    });

    expect(keyOf(await keys.keepFirst(TEAM, VaultKey.of('mine')))).toBe(
      'theirs',
    );
  });

  it('says a key this deployment did not seal cannot be read', async () => {
    const { keys } = keeping({
      teamId: TEAM.value,
      sealedKey: new SecretCipher(Buffer.alloc(32, 9).toString('base64')).seal(
        'theirs',
      ),
    });

    await expect(keys.of(TEAM)).resolves.toEqual({ kind: 'unreadable' });
    await expect(keys.keepFirst(TEAM, VaultKey.of('mine'))).resolves.toEqual({
      kind: 'unreadable',
    });
  });
});
