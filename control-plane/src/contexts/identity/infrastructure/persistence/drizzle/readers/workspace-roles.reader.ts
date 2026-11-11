import type { WorkspaceRolesPort } from '@identity/application/ports/workspace-roles.port';
import type { WorkspaceRoleName } from '@identity/domain/value-objects/workspace-role.vo';
import { workspaceMember } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkspaceRoles implements WorkspaceRolesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async rolesOf(
    person: UserId,
    workspaces: readonly WorkspaceId[],
  ): Promise<ReadonlyMap<string, WorkspaceRoleName>> {
    const unique = [...new Set(workspaces.map((each) => each.value))];

    if (unique.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        workspaceId: workspaceMember.workspaceId,
        role: workspaceMember.role,
      })
      .from(workspaceMember)
      .where(
        and(
          eq(workspaceMember.userId, person.value),
          inArray(workspaceMember.workspaceId, unique),
        ),
      );

    return new Map(rows.map((each) => [each.workspaceId, each.role]));
  }
}
