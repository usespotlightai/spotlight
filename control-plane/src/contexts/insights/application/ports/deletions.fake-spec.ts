import type { DeletionsPort } from '@insights/application/ports/deletions.port';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { Tombstones } from '@insights/domain/value-objects/tombstones.vo';

export const deletionsInMemory = (): DeletionsPort & {
  readonly locks: string[];
  deleted(scope: DeletionScope): boolean;
} => {
  const tasks = new Set<string>();
  const teams = new Set<string>();
  const workspaces = new Set<string>();
  const locks: string[] = [];
  const keyOf = (scope: DeletionScope): string =>
    scope.kind === 'task'
      ? scope.taskId.value
      : scope.kind === 'team'
        ? `${scope.workspaceId.value} ${scope.teamId.value}`
        : scope.workspaceId.value;
  const setOf = (scope: DeletionScope): Set<string> =>
    scope.kind === 'task' ? tasks : scope.kind === 'team' ? teams : workspaces;

  return {
    locks,
    deleted: (scope) => setOf(scope).has(keyOf(scope)),
    markDeleted: async (scope) => {
      setOf(scope).add(keyOf(scope));
    },
    tombstonesOf: async (owner: FactOwner) => {
      locks.push(
        [owner.workspaceId.value, owner.teamId?.value, owner.taskId?.value]
          .filter((each) => each !== undefined)
          .join(' '),
      );

      return Tombstones.of({
        workspace: workspaces.has(owner.workspaceId.value),
        team:
          owner.teamId !== null &&
          teams.has(`${owner.workspaceId.value} ${owner.teamId.value}`),
        task: owner.taskId !== null && tasks.has(owner.taskId.value),
      });
    },
  };
};
