import type { ResourceType } from '@shared-kernel/domain/value-objects/configuration-change.vo';

export const SECRET_USES = Symbol('SECRET_USES');

export interface NamedSecret {
  readonly workspaceId: string;
  readonly name: string;
}

export interface SecretUse {
  readonly kind: ResourceType;
  readonly key: string;
}

export interface SecretUser {
  usesOf(secret: NamedSecret): Promise<readonly SecretUse[]>;
}

export interface SecretUsesPort {
  register(user: SecretUser): void;

  of(secret: NamedSecret): Promise<readonly SecretUse[]>;
}
