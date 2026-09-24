import type { SecretSourceKind } from '@secrets/domain/value-objects/secret-source.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SECRET_RESOURCES = Symbol('SECRET_RESOURCES');

export interface KeptSecret {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly source: {
    readonly kind: SecretSourceKind;
    readonly secretId: string | null;
    readonly field: string | null;
  };
  readonly bindings: readonly {
    readonly host: string;
    readonly header: string;
    readonly prefix: string;
  }[];
  readonly valueVersion: number | null;
  readonly rotatedAt: Date;
}

export interface SecretResourcesPort {
  withId(id: string): Promise<KeptSecret | null>;

  named(workspaceId: WorkspaceId, name: string): Promise<KeptSecret | null>;

  secretsIn(workspaceId: WorkspaceId): Promise<readonly KeptSecret[]>;
}
