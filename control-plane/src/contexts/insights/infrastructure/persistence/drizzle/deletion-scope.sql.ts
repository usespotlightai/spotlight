import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { and, eq, type SQL } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';

interface ScopedColumns {
  readonly workspaceId: PgColumn;
  readonly teamId: PgColumn;
  readonly taskId?: PgColumn;
}

export const inScope = (columns: ScopedColumns, scope: DeletionScope): SQL => {
  switch (scope.kind) {
    case 'task':
      if (!columns.taskId) {
        throw new Error('This table keeps nothing of a single task');
      }

      return and(
        eq(columns.workspaceId, scope.workspaceId.value),
        eq(columns.taskId, scope.taskId.value),
      ) as SQL;
    case 'team':
      return and(
        eq(columns.workspaceId, scope.workspaceId.value),
        eq(columns.teamId, scope.teamId.value),
      ) as SQL;
    case 'workspace':
      return eq(columns.workspaceId, scope.workspaceId.value);
  }
};
