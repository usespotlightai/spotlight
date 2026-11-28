import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// The names of those workspaces that the viewer may see, by id. The rest stay unnamed.
export const workspaceNamesSeenBy = async (
  ports: {
    readonly access: Pick<WorkspaceAccessPort, 'viewableOf'>;
    readonly workspaces: Pick<WorkspaceReaderPort, 'profileOf'>;
  },
  viewer: UserId,
  workspaceIds: readonly WorkspaceId[],
): Promise<ReadonlyMap<string, string>> => {
  if (workspaceIds.length === 0) {
    return new Map();
  }

  const viewable = await ports.access.viewableOf(viewer, workspaceIds);
  const profiles = await Promise.all(
    viewable.map((each) => ports.workspaces.profileOf(each)),
  );

  return new Map(
    profiles.flatMap((each) => (each ? [[each.id, each.name] as const] : [])),
  );
};
