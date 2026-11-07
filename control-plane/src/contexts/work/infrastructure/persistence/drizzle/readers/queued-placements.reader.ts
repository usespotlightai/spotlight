import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { QueuedPlacementsPort } from '@work/application/ports/queued-placements.port';
import { waitsForAnyRunnerAt } from '@work/domain/value-objects/run-waiting';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class DrizzleQueuedPlacements implements QueuedPlacementsPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async unclaimedIn(
    workspaceId: WorkspaceId,
    now: Date,
  ): Promise<readonly RunnerPlacement[]> {
    const rows = await this.db
      .select({
        placement: run.placement,
        image: run.placementImage,
        state: run.state,
        claimableFrom: run.claimableFrom,
        reservedUntil: run.reservedUntil,
      })
      .from(run)
      .where(
        and(eq(run.workspaceId, workspaceId.value), eq(run.state, 'queued')),
      );

    return rows
      .filter((row) => waitsForAnyRunnerAt(row, now))
      .map((row) =>
        RunnerPlacement.ofLabelGroups(
          row.placement,
          row.image ? RunnerImage.of(row.image) : null,
        ),
      );
  }
}
