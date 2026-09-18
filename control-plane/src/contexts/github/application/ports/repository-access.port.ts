import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface RepositoryCredential {
  readonly username: string;
  readonly password: string;
}

export const REPOSITORY_ACCESS = Symbol('REPOSITORY_ACCESS');

export interface RepositoryAccessPort {
  // Never send this credential to a runner.
  credential(workspaceId: WorkspaceId): Promise<RepositoryCredential>;
}
