import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ScopedOwner {
  readonly workspaceId: WorkspaceId;
  readonly teamId?: TeamId | null;
  readonly taskId?: TaskId | null;
}

export const ownedIn = (scope: DeletionScope, owner: ScopedOwner): boolean => {
  if (!owner.workspaceId.equals(scope.workspaceId)) {
    return false;
  }

  switch (scope.kind) {
    case 'task':
      return owner.taskId?.equals(scope.taskId) ?? false;
    case 'team':
      return owner.teamId?.equals(scope.teamId) ?? false;
    case 'workspace':
      return true;
  }
};

export const inScope = <A>(
  stored: ReadonlyMap<string, A>,
  scope: DeletionScope,
  ownerOf: (aggregate: A) => ScopedOwner,
  max: number,
): readonly A[] =>
  [...stored.values()]
    .filter((each) => ownedIn(scope, ownerOf(each)))
    .slice(0, max);

export const removeVersioned = <A extends { readonly version: number }>(
  stored: Map<string, A>,
  key: string,
  removed: A,
  conflict: () => Error,
): void => {
  if (stored.get(key)?.version !== removed.version) {
    throw conflict();
  }

  stored.delete(key);
};
