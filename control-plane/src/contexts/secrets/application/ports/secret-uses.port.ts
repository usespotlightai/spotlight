export const SECRET_USES = Symbol('SECRET_USES');

export interface NamedSecret {
  readonly workspaceId: string;
  readonly name: string;
}

export interface SecretUser {
  usesOf(secret: NamedSecret): Promise<readonly string[]>;
}

export interface SecretUsesPort {
  register(user: SecretUser): void;

  of(secret: NamedSecret): Promise<readonly string[]>;
}
