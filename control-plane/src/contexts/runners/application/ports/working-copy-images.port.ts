import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKING_COPY_IMAGES = Symbol('WORKING_COPY_IMAGES');

export interface WorkingCopyImagesPort {
  lastRanIn(
    workspaceId: WorkspaceId,
    keys: readonly string[],
  ): Promise<ReadonlyMap<string, string>>;
}
