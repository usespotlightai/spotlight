import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// One installation serves one workspace at a time.
export const isHeldElsewhere = (
  holder: WorkspaceId | null,
  workspaceId: WorkspaceId,
): boolean => holder !== null && !holder.equals(workspaceId);
