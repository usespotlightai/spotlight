import type { ViewableWorkspacesPort } from '@identity/application/ports/viewable-workspaces.port';
import { workspaceMember } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleViewableWorkspaces implements ViewableWorkspacesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async viewableBy(
    viewer: UserId,
    workspaces: readonly WorkspaceId[],
  ): Promise<ReadonlySet<string>> {
    const unique = [...new Set(workspaces.map((each) => each.value))];

    if (unique.length === 0) {
      return new Set();
    }

    const rows = await this.db
      .select({ workspaceId: workspaceMember.workspaceId })
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.userId, viewer.value),
          inArray(workspaceMember.workspaceId, unique),
        ),
      );

    return new Set(rows.map((each) => each.workspaceId));
  }
}
