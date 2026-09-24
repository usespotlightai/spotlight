export const SECRET_USES = Symbol('SECRET_USES');

export interface NamedSecret {
  readonly workspaceId: string;
  readonly name: string;
}

export interface SecretUsesPort {
  of(secret: NamedSecret): Promise<readonly string[]>;
}
