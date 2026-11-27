import {
  POOL_ID,
  secretOf,
} from '@runners/domain/aggregates/runner-pool.fake-spec';
import { ProvisionSecretDecryptionFailedError } from '@runners/domain/exceptions/provision-secret-decryption-failed.error';
import { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
import { EncryptedProvisionSecrets } from '@runners/infrastructure/provision/encrypted-provision-secrets';
import { Credential } from '@secrets/application/contracts/credential.contract';
import { CredentialDecryptionFailedError } from '@secrets/application/errors/credential-decryption-failed.error';
import type { CredentialEncryptionPort } from '@secrets/application/ports/credential-encryption.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const HOLDER = { id: POOL_ID, workspaceId: WorkspaceId.of('ws_1') };

const encryption = (decrypts = true) =>
  ({
    encrypt: vi.fn((workspaceId: string, label: string, plain: Credential) =>
      Promise.resolve(`${workspaceId}|${label}|${plain.revealed()}`),
    ),
    decrypt: vi.fn(
      (_workspaceId: string, label: string, ciphertext: string) => {
        if (!decrypts) {
          return Promise.reject(new CredentialDecryptionFailedError(label));
        }
        return Promise.resolve(Credential.of(ciphertext.split('|')[2] ?? ''));
      },
    ),
  }) satisfies CredentialEncryptionPort;

describe('EncryptedProvisionSecrets', () => {
  it('encrypts a pool’s secret under its workspace and a label naming the pool, and decrypts it again', async () => {
    const vault = encryption();
    const secrets = new EncryptedProvisionSecrets(vault);

    const ciphertext = await secrets.encrypt(HOLDER, secretOf('s'));

    expect(vault.encrypt.mock.calls[0]?.slice(0, 2)).toEqual([
      'ws_1',
      'runner-pool:pool_1:provision-secret',
    ]);
    expect(vault.encrypt.mock.calls[0]?.[2].revealed()).toBe(
      secretOf('s').revealed(),
    );
    expect(
      (await secrets.decrypt(HOLDER, ciphertext)).equals(secretOf('s')),
    ).toBe(true);
  });

  it('fails when the keys of this deployment cannot decrypt a secret', async () => {
    const secrets = new EncryptedProvisionSecrets(encryption(false));
    const ciphertext = await secrets.encrypt(HOLDER, secretOf('s'));

    await expect(secrets.decrypt(HOLDER, ciphertext)).rejects.toThrow(
      ProvisionSecretDecryptionFailedError,
    );
  });

  it('says a stored secret that no longer has the shape of a signing secret is an inconsistent state', async () => {
    const secrets = new EncryptedProvisionSecrets(encryption());
    const ciphertext = await secrets.encrypt(HOLDER, secretOf('s'));
    const tampered = EncryptedProvisionSecret.of(
      `${ciphertext.value.split('|').slice(0, 2).join('|')}|hunter2`,
    );

    await expect(secrets.decrypt(HOLDER, tampered)).rejects.toThrow(
      InconsistentStateError,
    );
  });
});
