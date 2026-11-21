import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const SECRET_USE_LOCKS = Symbol('SECRET_USE_LOCKS');

export interface SecretUseLocksPort {
  lock(workspaceId: WorkspaceId): Promise<void>;
}
