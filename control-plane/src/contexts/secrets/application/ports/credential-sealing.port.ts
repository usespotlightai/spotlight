import type { Credential } from '@secrets/application/contracts/credential.contract';

export const CREDENTIAL_SEALING = Symbol('CREDENTIAL_SEALING');

export interface CredentialSealingPort {
  seal(
    workspaceId: string,
    label: string,
    credential: Credential,
  ): Promise<string>;

  open(workspaceId: string, label: string, sealed: string): Promise<Credential>;
}
