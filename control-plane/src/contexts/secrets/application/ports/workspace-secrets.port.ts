export const WORKSPACE_SECRETS = Symbol('WORKSPACE_SECRETS');

export interface WorkspaceSecretStore {
  readonly workspaceId: string;
  readonly name: string;
  readonly value: string | null;
}

export interface WorkspaceSecretsPort {
  store(secret: WorkspaceSecretStore): Promise<void>;

  reveal(workspaceId: string, name: string): Promise<string | null>;

  remove(workspaceId: string, name: string): Promise<void>;
}
