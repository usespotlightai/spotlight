import type { WorkspacesPort } from '@change-review/application/ports/workspaces.port';
import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class Workspaces implements WorkspacesPort {
  constructor(
    private readonly reader: WorkspaceReaderPort,
    private readonly access: WorkspaceAccessPort,
  ) {}

  slugOf(workspaceId: WorkspaceId): Promise<string | null> {
    return this.reader.slugOf(workspaceId.value);
  }

  mayView(viewer: UserId, workspaceId: WorkspaceId): Promise<boolean> {
    return this.access.mayView(viewer, workspaceId);
  }
}
