import { Credential } from '@secrets/application/contracts/credential.contract';
import { CredentialDecryptionFailedError } from '@secrets/application/errors/credential-decryption-failed.error';
import type { CredentialEncryptionPort } from '@secrets/application/ports/credential-encryption.port';
import {
  DecryptionFailedError,
  decrypt,
  encrypt,
} from '@secrets/infrastructure/crypto/envelope';
import type { WorkspaceKeys } from '@secrets/infrastructure/crypto/workspace-keys';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const aadFor = (workspaceId: string, label: string): string =>
  ['spotlight:credential:v1', workspaceId, label].join('\u0000');

export class WorkspaceCredentialEncryption implements CredentialEncryptionPort {
  constructor(private readonly keys: WorkspaceKeys) {}

  async encrypt(
    workspaceId: string,
    label: string,
    credential: Credential,
  ): Promise<string> {
    return encrypt(
      await this.keys.of(WorkspaceId.of(workspaceId)),
      Buffer.from(credential.revealed(), 'utf8'),
      aadFor(workspaceId, label),
    );
  }

  async decrypt(
    workspaceId: string,
    label: string,
    ciphertext: string,
  ): Promise<Credential> {
    try {
      return Credential.of(
        decrypt(
          await this.keys.of(WorkspaceId.of(workspaceId)),
          ciphertext,
          aadFor(workspaceId, label),
        ).toString('utf8'),
      );
    } catch (error) {
      if (error instanceof DecryptionFailedError) {
        throw new CredentialDecryptionFailedError(label);
      }

      throw error;
    }
  }
}
