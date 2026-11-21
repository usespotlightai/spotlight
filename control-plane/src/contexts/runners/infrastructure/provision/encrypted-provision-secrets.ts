import { Inject, Injectable } from '@nestjs/common';
import type {
  ProvisionSecretsPort,
  SecretHolder,
} from '@runners/application/ports/provision-secrets.port';
import { ProvisionSecretDecryptionFailedError } from '@runners/domain/exceptions/provision-secret-decryption-failed.error';
import { EncryptedProvisionSecret } from '@runners/domain/value-objects/encrypted-provision-secret.vo';
import { Credential } from '@secrets/application/contracts/credential.contract';
import { CredentialDecryptionFailedError } from '@secrets/application/errors/credential-decryption-failed.error';
import {
  CREDENTIAL_ENCRYPTION,
  type CredentialEncryptionPort,
} from '@secrets/application/ports/credential-encryption.port';
import { SigningSecret } from '@shared-kernel/domain/value-objects/signing-secret.vo';

const labelOf = (holder: SecretHolder): string =>
  `runner-pool:${holder.id.value}:provision-secret`;

@Injectable()
export class EncryptedProvisionSecrets implements ProvisionSecretsPort {
  constructor(
    @Inject(CREDENTIAL_ENCRYPTION)
    private readonly encryption: CredentialEncryptionPort,
  ) {}

  async encrypt(
    holder: SecretHolder,
    secret: SigningSecret,
  ): Promise<EncryptedProvisionSecret> {
    return EncryptedProvisionSecret.of(
      await this.encryption.encrypt(
        holder.workspaceId.value,
        labelOf(holder),
        Credential.of(secret.revealed()),
      ),
    );
  }

  async decrypt(
    holder: SecretHolder,
    ciphertext: EncryptedProvisionSecret,
  ): Promise<SigningSecret> {
    try {
      return SigningSecret.rehydrate(
        (
          await this.encryption.decrypt(
            holder.workspaceId.value,
            labelOf(holder),
            ciphertext.value,
          )
        ).revealed(),
      );
    } catch (error) {
      if (error instanceof CredentialDecryptionFailedError) {
        throw new ProvisionSecretDecryptionFailedError(holder.id.value);
      }

      throw error;
    }
  }
}
