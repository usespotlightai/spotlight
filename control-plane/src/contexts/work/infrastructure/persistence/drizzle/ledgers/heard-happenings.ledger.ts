import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { HeardHappeningsPort } from '@work/application/ports/heard-happenings.port';
import { heardHappening } from '@work/infrastructure/persistence/drizzle/schemas/heard-happening.schema';
import { and, eq, lt, sql } from 'drizzle-orm';

const hashed = (key: string): string =>
  createHash('sha256').update(key).digest('hex');

@Injectable()
export class DrizzleHeardHappenings implements HeardHappeningsPort {
  constructor(private readonly context: DrizzleContext) {}

  async heard(workspaceId: WorkspaceId, key: string): Promise<boolean> {
    const [found] = await this.context.db
      .select({ key: heardHappening.key })
      .from(heardHappening)
      .where(
        and(
          eq(heardHappening.workspaceId, workspaceId.value),
          eq(heardHappening.key, hashed(key)),
        ),
      );

    return found !== undefined;
  }

  async hearing(
    workspaceId: WorkspaceId,
    key: string,
    at: Date,
  ): Promise<boolean> {
    const first = await this.context.db
      .insert(heardHappening)
      .values({ workspaceId: workspaceId.value, key: hashed(key), heardAt: at })
      .onConflictDoNothing()
      .returning({ key: heardHappening.key });

    return first.length > 0;
  }

  async purgeBefore(before: Date, max: number): Promise<number> {
    const doomed = this.context.db
      .select({
        workspaceId: heardHappening.workspaceId,
        key: heardHappening.key,
      })
      .from(heardHappening)
      .where(lt(heardHappening.heardAt, before))
      .limit(max);
    const purged = await this.context.db
      .delete(heardHappening)
      .where(
        sql`(${heardHappening.workspaceId}, ${heardHappening.key}) in ${doomed}`,
      )
      .returning({ key: heardHappening.key });

    return purged.length;
  }
}
