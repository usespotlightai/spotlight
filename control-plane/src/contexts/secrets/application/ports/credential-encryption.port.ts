import type { Credential } from '@secrets/application/contracts/credential.contract';

export const CREDENTIAL_ENCRYPTION = Symbol('CREDENTIAL_ENCRYPTION');

export interface CredentialEncryptionPort {
  encrypt(
    workspaceId: string,
    label: string,
    credential: Credential,
  ): Promise<string>;

  decrypt(
    workspaceId: string,
    label: string,
    ciphertext: string,
  ): Promise<Credential>;
}
