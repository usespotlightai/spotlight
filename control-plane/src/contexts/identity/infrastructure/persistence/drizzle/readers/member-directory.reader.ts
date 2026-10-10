import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { workspaceMember } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, sql } from 'drizzle-orm';

@Injectable()
export class DrizzleMemberDirectory implements MemberDirectoryPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async byEmail(
    workspaceId: WorkspaceId,
    email: string,
  ): Promise<UserId | null> {
    const wanted = email.trim();

    if (wanted.length === 0) {
      return null;
    }

    const [found] = await this.db
      .select({ id: user.id })
      .from(workspaceMember)
      .innerJoin(user, eq(user.id, workspaceMember.userId))
      .where(
        and(
          eq(workspaceMember.workspaceId, workspaceId.value),
          sql`lower(${user.email}) = lower(${wanted})`,
        ),
      )
      .limit(1);

    return found ? UserId.of(found.id) : null;
  }
}
