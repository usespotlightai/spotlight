import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const LINE_IMAGES = Symbol('LINE_IMAGES');

export interface LineImagesPort {
  namedIn(workspaceId: WorkspaceId): Promise<readonly string[]>;
}
