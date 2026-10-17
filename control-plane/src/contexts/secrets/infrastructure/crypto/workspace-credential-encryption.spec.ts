import { randomBytes } from 'node:crypto';
import { Credential } from '@secrets/application/contracts/credential.contract';
import { CredentialDecryptionFailedError } from '@secrets/application/errors/credential-decryption-failed.error';
import { DecryptionFailedError } from '@secrets/infrastructure/crypto/envelope';
import { WorkspaceCredentialEncryption } from '@secrets/infrastructure/crypto/workspace-credential-encryption';
import type { WorkspaceKeys } from '@secrets/infrastructure/crypto/workspace-keys';
import { describe, expect, it } from 'vitest';

const keyed = (key: Buffer) =>
  new WorkspaceCredentialEncryption({
    of: async () => key,
  } as unknown as WorkspaceKeys);

const keyless = (error: Error) =>
  new WorkspaceCredentialEncryption({
    of: async () => {
      throw error;
    },
  } as unknown as WorkspaceKeys);

const PLAIN = Credential.of('plain');

describe('WorkspaceCredentialEncryption', () => {
  it('decrypts what it encrypted', async () => {
    const encryption = keyed(randomBytes(32));
    const ciphertext = await encryption.encrypt('ws_1', 'label', PLAIN);

    const decrypted = await encryption.decrypt('ws_1', 'label', ciphertext);

    expect(decrypted.revealed()).toBe('plain');
    expect(`${decrypted}`).not.toContain('plain');
  });

  it('says that a credential encrypted with another key does not decrypt', async () => {
    const ciphertext = await keyed(randomBytes(32)).encrypt(
      'ws_1',
      'label',
      PLAIN,
    );

    await expect(
      keyed(randomBytes(32)).decrypt('ws_1', 'label', ciphertext),
    ).rejects.toBeInstanceOf(CredentialDecryptionFailedError);
  });

  it('says that a credential does not decrypt when the workspace key itself does not unwrap', async () => {
    const ciphertext = await keyed(randomBytes(32)).encrypt(
      'ws_1',
      'label',
      PLAIN,
    );

    await expect(
      keyless(new DecryptionFailedError('another master key')).decrypt(
        'ws_1',
        'label',
        ciphertext,
      ),
    ).rejects.toBeInstanceOf(CredentialDecryptionFailedError);
  });

  it('lets any other failure through as it is', async () => {
    const down = new Error('the database is down');
    const ciphertext = await keyed(randomBytes(32)).encrypt(
      'ws_1',
      'label',
      PLAIN,
    );

    await expect(
      keyless(down).decrypt('ws_1', 'label', ciphertext),
    ).rejects.toBe(down);
  });
});
