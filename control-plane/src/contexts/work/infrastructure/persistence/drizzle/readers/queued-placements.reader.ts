import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { QueuedPlacementsPort } from '@work/application/ports/queued-placements.port';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, eq, isNull, lte, or } from 'drizzle-orm';

@Injectable()
export class DrizzleQueuedPlacements implements QueuedPlacementsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async unclaimedIn(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly RunnerPlacement[]> {
    const rows = await this.db
      .select({ placement: run.placement, image: run.placementImage })
      .from(run)
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          eq(run.state, 'queued'),
          or(isNull(run.reservedUntil), lte(run.reservedUntil, now)),
        ),
      );

    return rows.map((row) =>
      RunnerPlacement.ofClauses(
        row.placement,
        row.image ? RunnerImage.of(row.image) : null,
      ),
    );
  }
}
