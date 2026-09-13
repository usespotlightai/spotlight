import {
  NOT_AGE,
  NOT_FOR_THIS_KEY,
  NOT_SECRETS,
  newVaultKey,
  openVault,
  sealVault,
  VaultError,
  WORK_FACTOR,
} from '@infrastructure/secrets/age-vault';
import { armor, Decrypter, Encrypter } from 'age-encryption';
import { describe, expect, it } from 'vitest';

const SECRETS = {
  SLACK_BOT_TOKEN: 'xoxb-1',
  LINEAR_WEBHOOK_SECRET: 'pässwörd ✓ 🔑',
};

const WRITTEN_BY_AGE = `-----BEGIN AGE ENCRYPTED FILE-----
YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IHNjcnlwdCB3UEVqeGY3c2JiS0JjODZU
elRINWZBIDEwCkdkM0w1Zk1IalBicUJZeTduTEwxTzYwbUxHM3puTG9HYVFqWUxB
RkNySEkKLS0tIGtuUFhnZWZnczVwN3R3U0ZGWHBGMzhOZW0zWGkwdkNiR0Y4cUZk
WHdjazQKK+F/7/cJQQX8lv29ErsMZ1rPvJQ0sTS5x1gZpfsv5X5bP/YbQFuzHNDK
cj7MlP3sKymLTGPEy3HpBahajZbyOkapoTGqJq7NUjF/Tg==
-----END AGE ENCRYPTED FILE-----
`;

const sealed = async (text: string): Promise<string> => {
  const encrypter = new Encrypter();
  encrypter.setPassphrase('k');
  encrypter.setScryptWorkFactor(WORK_FACTOR);
  return armor.encode(await encrypter.encrypt(text));
};

describe('the age vault', () => {
  it('opens with the vault key it was encrypted with, and no other', async () => {
    const vault = await sealVault(SECRETS, 'vault-key');

    expect(vault.startsWith('-----BEGIN AGE ENCRYPTED FILE-----')).toBe(true);
    expect(vault).not.toContain('SLACK_BOT_TOKEN');
    await expect(openVault(vault, 'vault-key')).resolves.toEqual(SECRETS);
    await expect(openVault(vault, 'another-key')).rejects.toThrow(
      NOT_FOR_THIS_KEY,
    );
  });

  it('opens a vault written by the age tool itself, as a team would write one by hand', async () => {
    await expect(
      openVault(WRITTEN_BY_AGE, 'fixture-team-key-not-a-real-one'),
    ).resolves.toEqual({ GRAFANA_TOKEN: 'fake-fixture-token' });
  });

  it('encrypts at a work factor that stays quick, since the vault key is random rather than chosen', async () => {
    const vault = await sealVault(SECRETS, 'vault-key');
    const header = Buffer.from(armor.decode(vault)).toString('latin1');

    expect(header).toMatch(new RegExp(`-> scrypt \\S+ ${WORK_FACTOR}\\n`));
  });

  it('holds its secrets as YAML, sorted by name', async () => {
    const vault = await sealVault({ B_SECRET: 'two', A_SECRET: '1' }, 'k');
    const decrypter = new Decrypter();
    decrypter.addPassphrase('k');

    await expect(decrypter.decrypt(armor.decode(vault), 'text')).resolves.toBe(
      'A_SECRET: "1"\nB_SECRET: two\n',
    );
  });

  it('reads a vault written by hand exactly as its values were typed', async () => {
    const vault = await sealed(
      [
        '# rotated in September',
        'FLAG: yes',
        'PIN: 0123',
        'NOTHING: null',
        'KEY: |',
        '  -----BEGIN KEY-----',
        '  abc',
        '  -----END KEY-----',
      ].join('\n'),
    );

    await expect(openVault(vault, 'k')).resolves.toEqual({
      FLAG: 'yes',
      PIN: '0123',
      NOTHING: 'null',
      KEY: '-----BEGIN KEY-----\nabc\n-----END KEY-----\n',
    });
  });

  it('keeps every value whole when written back', async () => {
    const held = {
      LONG: `${'word '.repeat(40)}end`,
      PIN: '0123',
      KEY: '-----BEGIN KEY-----\nabc\n-----END KEY-----\n',
    };

    await expect(openVault(await sealVault(held, 'k'), 'k')).resolves.toEqual(
      held,
    );
  });

  it('refuses what is not an armored age file', async () => {
    await expect(openVault('SLACK_BOT_TOKEN: x', 'k')).rejects.toThrow(NOT_AGE);
  });

  it('says a vault that will not decrypt is broken, rather than blaming the key', async () => {
    const broken = armor.encode(
      new TextEncoder().encode('age-encryption.org/v1\n-> scrypt nonsense\n'),
    );

    const refused = openVault(broken, 'k');

    await expect(refused).rejects.toThrow(/could not be decrypted/);
    await expect(refused).rejects.not.toThrow(NOT_FOR_THIS_KEY);
  });

  it('refuses an age file that holds something other than secrets', async () => {
    await expect(
      openVault(await sealed('- not\n- secrets\n'), 'k'),
    ).rejects.toThrow(NOT_SECRETS);
    await expect(
      openVault(await sealed('NESTED:\n  TOKEN: x\n'), 'k'),
    ).rejects.toThrow(NOT_SECRETS);
    await expect(
      openVault(await sealed('TOKEN: [unclosed'), 'k'),
    ).rejects.toThrow(NOT_SECRETS);
  });

  it('says why a vault does not open, by reason', async () => {
    const vault = await sealVault(SECRETS, 'vault-key');
    const reasonFor = (refused: Promise<unknown>) =>
      refused.then(
        () => null,
        (error: unknown) =>
          error instanceof VaultError ? error.reason : error,
      );

    await expect(reasonFor(openVault(vault, 'another-key'))).resolves.toBe(
      'not-for-this-key',
    );
    await expect(reasonFor(openVault('SLACK_BOT_TOKEN: x', 'k'))).resolves.toBe(
      'not-age',
    );
  });

  it('makes keys that are long, and never the same twice', () => {
    const key = newVaultKey();

    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newVaultKey()).not.toBe(key);
  });
});
