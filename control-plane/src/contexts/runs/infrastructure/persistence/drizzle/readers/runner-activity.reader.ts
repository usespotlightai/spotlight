import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  RunnerActivityReaderPort,
  RunnerActivityRow,
} from '@runs/application/ports/runner-activity-reader.port';
import { isLeasedState } from '@runs/domain/value-objects/run-state';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';

@Injectable()
export class DrizzleRunnerActivityReader implements RunnerActivityReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async leasedIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly RunnerActivityRow[]> {
    const rows = await this.db
      .select({
        id: run.id,
        workspaceId: run.workspaceId,
        state: run.state,
        claimedBy: run.claimedBy,
        teamId: run.teamId,
        requesterOwner: run.requesterOwner,
        requesterKind: run.requesterKind,
        requesterId: run.requesterId,
        requesterToken: run.requesterToken,
        holdsTurn: run.holdsTurn,
        gated: run.gated,
        actsBeyondItself: run.actsBeyondItself,
        asks: run.asks,
        listed: run.listed,
        exclusive: run.exclusive,
      })
      .from(run)
      .where(
        and(
          eq(run.workspaceId, workspaceId.value),
          isNotNull(run.claimedBy),
          isNull(run.endedAt),
        ),
      );

    return rows.flatMap((row) =>
      row.claimedBy && isLeasedState(row.state)
        ? [
            {
              runnerId: row.claimedBy,
              runId: RunId.of(row.id),
              workspaceId: WorkspaceId.of(row.workspaceId),
              state: row.state,
              requester: {
                owner: row.requesterOwner,
                kind: row.requesterKind,
                id: row.requesterId,
                token: row.requesterToken,
                team: row.teamId,
              },
              policy: {
                holdsTurn: row.holdsTurn,
                gated: row.gated,
                actsBeyondItself: row.actsBeyondItself,
                asks: row.asks,
                listed: row.listed,
                exclusive: row.exclusive,
              },
              teamId: row.teamId,
            },
          ]
        : [],
    );
  }
}
