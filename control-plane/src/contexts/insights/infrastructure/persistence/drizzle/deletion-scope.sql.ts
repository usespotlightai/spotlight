import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

interface ScopedColumns {
  readonly workspaceId: PgColumn;
  readonly teamId: PgColumn;
  readonly taskId?: PgColumn;
}

const allOf = (...conditions: readonly SQL[]): SQL => {
  const joined = and(...conditions);

  if (joined === undefined) {
    throw new Error('A scope needs at least one condition');
  }

  return joined;
};

export const inScope = (columns: ScopedColumns, scope: DeletionScope): SQL => {
  switch (scope.kind) {
    case 'task':
      if (!columns.taskId) {
        throw new Error('This table keeps nothing of a single task');
      }

      return allOf(
        eq(columns.workspaceId, scope.workspaceId.value),
        eq(columns.taskId, scope.taskId.value),
      );
    case 'team':
      return allOf(
        eq(columns.workspaceId, scope.workspaceId.value),
        eq(columns.teamId, scope.teamId.value),
      );
    case 'workspace':
      return eq(columns.workspaceId, scope.workspaceId.value);
  }
};
