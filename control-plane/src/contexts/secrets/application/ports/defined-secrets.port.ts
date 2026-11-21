export const DEFINED_SECRETS = Symbol('DEFINED_SECRETS');

export interface DefinedSecretsPort {
  namesIn(workspaceId: string): Promise<readonly string[]>;

  sandboxSecrets(workspaceId: string): Promise<readonly string[]>;
}
