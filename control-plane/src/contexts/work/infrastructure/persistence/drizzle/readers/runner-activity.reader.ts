import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  HeldRun,
  RunnerActivityReaderPort,
} from '@work/application/ports/runner-activity-reader.port';
import { run } from '@work/infrastructure/persistence/drizzle/schemas/run.schema';
import { and, eq, isNotNull } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerActivityReader implements RunnerActivityReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async heldIn(workspaceId: WorkspaceId): Promise<readonly HeldRun[]> {
    const rows = await this.db
      .select({ id: run.id, state: run.state, claimedBy: run.claimedBy })
      .from(run)
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          eq(run.state, 'claimed'),
          isNotNull(run.claimedBy),
        ),
      );

    return rows.flatMap((row) =>
      row.claimedBy
        ? [{ runnerId: row.claimedBy, runId: row.id, state: row.state }]
        : [],
    );
  }
}
