import { InvalidPageCursorError } from '@identity/application/errors/invalid-page-cursor.error';
import type {
  DirectoryPage,
  DirectoryRequest,
  DirectoryWorkspace,
  WorkspaceDirectoryPort,
} from '@identity/application/ports/workspace-directory.port';
import {
  workspace,
  workspaceMember,
} from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  after,
  type Cursor,
  decodeCursor,
  isSortableTime,
  pageOf,
  sortableTime,
} from '@platform/persistence/drizzle/keyset';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, gt, type SQL, sql } from 'drizzle-orm';

const COLUMNS = {
  id: workspace.id,
  slug: workspace.slug,
  name: workspace.name,
  createdAt: workspace.createdAt,
  createdKey: sortableTime(workspace.createdAt),
  memberCount: sql<number>`(select count(*) from ${workspaceMember} where ${workspaceMember.workspaceId} = ${workspace.id})`.mapWith(
    Number,
  ),
};

type DirectoryRow = DirectoryWorkspace & { readonly createdKey: string };

const listed = (row: DirectoryRow): DirectoryWorkspace => ({
  id: row.id,
  slug: row.slug,
  name: row.name,
  createdAt: row.createdAt,
  memberCount: row.memberCount,
});

const cursorOf = (raw: string | null): Cursor | null => {
  if (raw === null) {
    return null;
  }

  const cursor = decodeCursor(raw);

  if (!cursor || !isSortableTime(cursor.key)) {
    throw new InvalidPageCursorError();
  }

  return cursor;
};

@Injectable()
export class DrizzleWorkspaceDirectory implements WorkspaceDirectoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async list(request: DirectoryRequest): Promise<DirectoryPage> {
    const cursor = cursorOf(request.after);
    const conditions: SQL[] = [
      ...(request.createdAfter
        ? [gt(workspace.createdAt, request.createdAfter)]
        : []),
      ...(cursor
        ? [after(sortableTime(workspace.createdAt), workspace.id, cursor)]
        : []),
    ];
    const rows = await this.db
      .select(COLUMNS)
      .from(workspace)
      .where(and(...conditions))
      .orderBy(asc(workspace.createdAt), asc(workspace.id))
      .limit(request.limit + 1);
    const page = pageOf(rows, request.limit, (row) => ({
      key: row.createdKey,
      id: row.id,
    }));

    return { items: page.items.map(listed), next: page.next };
  }

  async find(workspaceId: WorkspaceId): Promise<DirectoryWorkspace | null> {
    const [found] = await this.db
      .select(COLUMNS)
      .from(workspace)
      .where(eq(workspace.id, workspaceId.value))
      .limit(1);

    return found ? listed(found) : null;
  }
}
