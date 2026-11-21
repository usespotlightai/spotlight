import type {
  DirectoryPageRequest,
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
  pageOf,
  sortableTime,
} from '@platform/persistence/drizzle/keyset';
import { timeCursorOf } from '@platform/persistence/drizzle/page-cursor';
import type { Page } from '@shared-kernel/application/dto/page.dto';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, gte, type SQL, sql } from 'drizzle-orm';

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

interface DirectoryRow {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly createdKey: string;
  readonly memberCount: number;
}

const listed = (row: DirectoryRow): DirectoryWorkspace => ({
  id: WorkspaceId.of(row.id),
  slug: row.slug,
  name: row.name,
  createdAt: row.createdAt,
  memberCount: row.memberCount,
});

@Injectable()
export class DrizzleWorkspaceDirectory implements WorkspaceDirectoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async list(request: DirectoryPageRequest): Promise<Page<DirectoryWorkspace>> {
    const cursor = timeCursorOf(request.after);
    const conditions: SQL[] = [
      ...(request.since
        ? [gte(workspace.createdAt, request.since)]
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
