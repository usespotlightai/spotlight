import { Inject, Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import type {
  ActivityRunRow,
  RunnerActivityReaderPort,
  RunnerActivityRow,
  WorkingCopyRunRow,
} from '@runs/application/ports/runner-activity-reader.port';
import { lastUseOf } from '@runs/domain/services/working-copy-last-use';
import { isLeasedState } from '@runs/domain/value-objects/run-state';
import { run } from '@runs/infrastructure/persistence/drizzle/schemas/run.schema';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

const COLUMNS = {
  id: run.id,
  workspaceId: run.workspaceId,
  state: run.state,
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
};

type ActivityColumns = Pick<typeof run.$inferSelect, keyof typeof COLUMNS>;

const activityRunOf = (row: ActivityColumns): ActivityRunRow => ({
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
});

@Injectable()
export class DrizzleRunnerActivityReader implements RunnerActivityReaderPort {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDatabase) {}

  async leasedIn(
    workspaceId: WorkspaceId,
  ): Promise<readonly RunnerActivityRow[]> {
    const rows = await this.db
      .select({ ...COLUMNS, claimedBy: run.claimedBy })
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
        ? [{ ...activityRunOf(row), runnerId: row.claimedBy }]
        : [],
    );
  }

  async lastRunsOf(
    workspaceId: WorkspaceId,
    keys: readonly string[],
  ): Promise<readonly WorkingCopyRunRow[]> {
    if (keys.length === 0) {
      return [];
    }

    const rows = await this.db
      .select({
        ...COLUMNS,
        workingCopyKey: run.workingCopyKey,
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

    return keys.flatMap((workingCopyKey) => {
      const last = lastUseOf(
        rows.filter((each) => each.workingCopyKey === workingCopyKey),
      );

      return last === null ? [] : [{ ...activityRunOf(last), workingCopyKey }];
    });
  }
}
