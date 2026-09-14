import { SealedVault } from '@domain/value-objects/sealed-vault.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SecretValue } from '@domain/value-objects/secret-value.vo';
import { VaultKey } from '@domain/value-objects/vault-key.vo';
import { VaultSecrets } from '@domain/value-objects/vault-secrets.vo';
import { sealVault } from '@infrastructure/secrets/age-vault';
import { AgeVaultSealing } from '@infrastructure/secrets/age-vault-sealing';
import { describe, expect, it } from 'vitest';

const KEY = VaultKey.of('vault-key');

const SECRETS = VaultSecrets.of([
  {
    name: SecretName.of('SLACK_BOT_TOKEN'),
    value: SecretValue.maybe('xoxb-fake') as SecretValue,
  },
]);

describe('AgeVaultSealing', () => {
  it('opens what it sealed, with the key it sealed it with', async () => {
    const sealing = new AgeVaultSealing();
    const vault = await sealing.seal(SECRETS, KEY);

    const opening = await sealing.open(vault, KEY);

    expect(vault.text).not.toContain('xoxb-fake');
    expect(
      opening.opened
        ? opening.secrets.valueOf(SecretName.of('SLACK_BOT_TOKEN'))?.value
        : null,
    ).toBe('xoxb-fake');
  });

  it('says a vault is not for a key that does not open it', async () => {
    const sealing = new AgeVaultSealing();
    const vault = await sealing.seal(SECRETS, KEY);

    await expect(
      sealing.open(vault, VaultKey.of('another-key')),
    ).resolves.toMatchObject({ opened: false, because: 'not-for-this-key' });
  });

  it('says a vault that is not an age file cannot be read', async () => {
    await expect(
      new AgeVaultSealing().open(SealedVault.of('SLACK_BOT_TOKEN: x'), KEY),
    ).resolves.toMatchObject({ opened: false, because: 'unreadable' });
  });

  it('says a vault holding a name no secret could have cannot be read', async () => {
    const vault = SealedVault.of(
      await sealVault({ 'linear secret': 'x' }, KEY.value),
    );

    await expect(new AgeVaultSealing().open(vault, KEY)).resolves.toMatchObject(
      { opened: false, because: 'unreadable' },
    );
  });

  it('issues keys that are long, and never the same twice', () => {
    const sealing = new AgeVaultSealing();
    const key = sealing.issueKey();

    expect(key.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sealing.issueKey().equals(key)).toBe(false);
  });
});
