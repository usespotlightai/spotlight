import type {
  VaultOpening,
  VaultSealingPort,
} from '@application/ports/vault-sealing.port';
import { TeamVault } from '@application/services/team-vault.service';
import { UnopenableVaultError } from '@domain/exceptions/unopenable-vault.error';
import type {
  VaultKeyLookup,
  VaultKeyRepository,
} from '@domain/repositories/vault-key.repository';
import { SealedVault } from '@domain/value-objects/sealed-vault.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SecretValue } from '@domain/value-objects/secret-value.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { VaultKey } from '@domain/value-objects/vault-key.vo';
import { VaultSecrets } from '@domain/value-objects/vault-secrets.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const sealedWith = (key: string, secrets: Record<string, string>) =>
  SealedVault.of(`${key}\n${JSON.stringify(secrets)}`);

const secretsOf = (held: Record<string, string>) =>
  VaultSecrets.of(
    Object.entries(held).map(([name, value]) => ({
      name: SecretName.of(name),
      value: SecretValue.maybe(value) as SecretValue,
    })),
  );

const STANDING = {
  SLACK_BOT_TOKEN: 'xoxb-fake',
  LINEAR_WEBHOOK_SECRET: 'lin-fake',
};

const sealing = {
  issueKey: () => VaultKey.of('issued-key'),
  open: async (vault: SealedVault, key: VaultKey): Promise<VaultOpening> => {
    const [lock, body] = vault.text.split('\n');

    if (lock === 'unreadable') {
      return { opened: false, because: 'unreadable', detail: 'is not age' };
    }
    if (lock !== key.value) {
      return { opened: false, because: 'not-for-this-key', detail: '' };
    }

    return {
      opened: true,
      secrets: secretsOf(JSON.parse(body ?? '{}') as Record<string, string>),
    };
  },
  seal: async (secrets: VaultSecrets, key: VaultKey) =>
    sealedWith(
      key.value,
      Object.fromEntries(
        secrets.entries.map((each) => [each.name.value, each.value.value]),
      ),
    ),
} satisfies VaultSealingPort;

const keeping = (standing: VaultKeyLookup = heldKey('vault-key')) => {
  let lookup = standing;
  const keys = {
    of: async () => lookup,
    keepFirst: async (_teamId: TeamId, key: VaultKey) => {
      if (lookup.kind === 'none') {
        lookup = { kind: 'held', key };
      }
      return lookup;
    },
  } satisfies VaultKeyRepository;

  return { vault: new TeamVault(keys, sealing), kept: () => lookup };
};

function heldKey(key: string): VaultKeyLookup {
  return { kind: 'held', key: VaultKey.of(key) };
}

const lockOf = (vault: SealedVault) => vault.text.split('\n')[0];
const bodyOf = (vault: SealedVault) =>
  JSON.parse(vault.text.split('\n')[1] ?? '');

describe('TeamVault', () => {
  describe('reading a vault the configuration holds', () => {
    it('names what it holds', async () => {
      const read = await keeping().vault.read(
        TEAM,
        sealedWith('vault-key', STANDING),
      );

      expect(read.refusal).toBeNull();
      expect(read.names.map((each) => each.value)).toEqual([
        'LINEAR_WEBHOOK_SECRET',
        'SLACK_BOT_TOKEN',
      ]);
    });

    it('says why one does not open', async () => {
      const refusal = async (vault: SealedVault, lookup?: VaultKeyLookup) =>
        (await keeping(lookup).vault.read(TEAM, vault)).refusal;

      await expect(
        refusal(sealedWith('someone-else', STANDING)),
      ).resolves.toMatchObject({ because: 'not-for-this-key' });
      await expect(
        refusal(SealedVault.of('unreadable\n')),
      ).resolves.toMatchObject({ because: 'unreadable', detail: 'is not age' });
      await expect(
        refusal(sealedWith('vault-key', STANDING), { kind: 'none' }),
      ).resolves.toEqual({ because: 'unkeyed' });
      await expect(
        refusal(sealedWith('vault-key', STANDING), { kind: 'unreadable' }),
      ).resolves.toEqual({ because: 'unreadable-key' });
    });

    it('names nothing in a vault that does not open', async () => {
      const read = await keeping().vault.read(
        TEAM,
        sealedWith('someone-else', STANDING),
      );

      expect(read.names).toEqual([]);
    });
  });

  describe('sealing secrets into the vault', () => {
    it('seals what is added into what the vault already held, with the key it held', async () => {
      const sealed = await keeping().vault.sealedWith(
        TEAM,
        sealedWith('vault-key', STANDING),
        secretsOf({ LINEAR_WEBHOOK_SECRET: 'lin-fake-2' }),
      );

      expect(lockOf(sealed)).toBe('vault-key');
      expect(bodyOf(sealed)).toEqual({
        LINEAR_WEBHOOK_SECRET: 'lin-fake-2',
        SLACK_BOT_TOKEN: 'xoxb-fake',
      });
    });

    it('seals a first vault with the key the team holds', async () => {
      const sealed = await keeping().vault.sealedWith(
        TEAM,
        null,
        secretsOf(STANDING),
      );

      expect(lockOf(sealed)).toBe('vault-key');
      expect(bodyOf(sealed)).toEqual(STANDING);
    });

    it('issues and keeps a key to seal a first vault where the team holds none', async () => {
      const { vault, kept } = keeping({ kind: 'none' });

      const sealed = await vault.sealedWith(TEAM, null, secretsOf(STANDING));

      expect(lockOf(sealed)).toBe('issued-key');
      expect(kept()).toEqual(heldKey('issued-key'));
    });

    it('refuses to seal over a vault that does not open', async () => {
      await expect(
        keeping().vault.sealedWith(
          TEAM,
          sealedWith('someone-else', STANDING),
          VaultSecrets.none(),
        ),
      ).rejects.toThrow(UnopenableVaultError);
    });

    it('refuses to seal over a vault it holds no key for, and issues none', async () => {
      const { vault, kept } = keeping({ kind: 'none' });

      await expect(
        vault.sealedWith(
          TEAM,
          sealedWith('vault-key', STANDING),
          secretsOf({ SENTRY_TOKEN: 'sentry-fake' }),
        ),
      ).rejects.toThrow(UnopenableVaultError);
      expect(kept()).toEqual({ kind: 'none' });
    });

    it('refuses to seal where the key it holds cannot be read', async () => {
      const { vault } = keeping({ kind: 'unreadable' });

      await expect(
        vault.sealedWith(TEAM, null, secretsOf(STANDING)),
      ).rejects.toThrow(UnopenableVaultError);
      await expect(
        vault.sealedWith(
          TEAM,
          sealedWith('vault-key', STANDING),
          secretsOf(STANDING),
        ),
      ).rejects.toThrow(UnopenableVaultError);
    });
  });

  describe('revealing the key', () => {
    it('issues a key the first time one is needed, and keeps that one after', async () => {
      const { vault, kept } = keeping({ kind: 'none' });

      expect((await vault.revealKey(TEAM)).value).toBe('issued-key');
      expect((await vault.revealKey(TEAM)).value).toBe('issued-key');
      expect(kept()).toEqual(heldKey('issued-key'));
    });

    it('gives the key the team already holds', async () => {
      expect((await keeping().vault.revealKey(TEAM)).value).toBe('vault-key');
    });

    it('refuses where the key it holds cannot be read', async () => {
      await expect(
        keeping({ kind: 'unreadable' }).vault.revealKey(TEAM),
      ).rejects.toThrow(UnopenableVaultError);
    });
  });
});
