export const CREDENTIAL_SEALING = Symbol('CREDENTIAL_SEALING');

export interface CredentialSealingPort {
  seal(workspaceId: string, label: string, plain: string): Promise<string>;

  open(workspaceId: string, label: string, sealed: string): Promise<string>;
}
