import type { SecretSandbox } from '@secrets/domain/value-objects/secret-sandbox.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SECRET_RESOURCES = Symbol('SECRET_RESOURCES');

export interface SecretRecord {
  readonly id: string;
  readonly version: number;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly bindings: readonly {
    readonly host: string;
    readonly location: string;
    readonly name: string;
    readonly prefix: string;
  }[];
  readonly sandbox: SecretSandbox;
  readonly valueVersion: number | null;
  readonly holdsValue: boolean;
  readonly rotatedAt: Date;
}

export interface SecretResourcesPort {
  withId(id: string): Promise<SecretRecord | null>;

  named(workspaceId: WorkspaceId, name: string): Promise<SecretRecord | null>;

  namedIn(
    workspaceId: WorkspaceId,
    names: readonly string[],
  ): Promise<readonly SecretRecord[]>;

  secretsIn(workspaceId: WorkspaceId): Promise<readonly SecretRecord[]>;
}
