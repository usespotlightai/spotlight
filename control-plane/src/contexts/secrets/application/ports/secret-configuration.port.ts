import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SECRET_CONFIGURATION = Symbol('SECRET_CONFIGURATION');

export interface SecretView {
  readonly id: string;
  readonly address: string;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  readonly bindings: readonly {
    readonly host: string;
    readonly location: string;
    readonly name: string;
    readonly prefix: string;
  }[];
  readonly sandbox: string | null;
  readonly valueVersion: number | null;
}

export interface SecretConfigurationPort {
  in(workspaceId: WorkspaceId): Promise<readonly SecretView[]>;

  withId(id: string): Promise<SecretView | null>;
}
