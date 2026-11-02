import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import { user } from '@identity/infrastructure/persistence/drizzle/schemas/auth.schema';
import { userEmail } from '@identity/infrastructure/persistence/drizzle/schemas/user-email.schema';
import { workspaceMember } from '@identity/infrastructure/persistence/drizzle/schemas/workspace.schema';
import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNotNull, or, sql } from 'drizzle-orm';

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
          or(
            sql`lower(${user.email}) = lower(${wanted})`,
            sql`exists (${this.db
              .select({ one: sql`1` })
              .from(userEmail)
              .where(
                and(
                  eq(userEmail.userId, user.id),
                  isNotNull(userEmail.verifiedAt),
                  sql`lower(${userEmail.email}) = lower(${wanted})`,
                ),
              )})`,
          ),
        ),
      )
      .orderBy(sql`lower(${user.email}) = lower(${wanted}) desc`)
      .limit(1);

    return found ? UserId.of(found.id) : null;
  }
}
