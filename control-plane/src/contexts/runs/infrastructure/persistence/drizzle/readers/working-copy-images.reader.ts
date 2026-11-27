import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkingCopyImagesPort } from '@runners/application/ports/working-copy-images.port';
import { lastUseOf } from '@runs/domain/services/working-copy-last-use';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';

@Injectable()
export class DrizzleWorkingCopyImages implements WorkingCopyImagesPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async lastRanIn(
    workspaceId: WorkspaceId,
    keys: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (keys.length === 0) {
      return new Map();
    }

    const rows = await this.db
      .select({
        id: run.id,
        workingCopyKey: run.workingCopyKey,
        ranIn: run.ranIn,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
      })
      .from(run)
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          inArray(run.workingCopyKey, [...keys]),
          isNotNull(run.startedAt),
        ),
      );

    return new Map(
      keys.flatMap((key) => {
        const ranIn = lastUseOf(
          rows.filter((each) => each.workingCopyKey === key),
        )?.ranIn;

        return nonEmpty(ranIn) ? [[key, ranIn] as const] : [];
      }),
    );
  }
}
