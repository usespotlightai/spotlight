import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ReplayRunDecision } from '@replays/domain/aggregates/replay-run-decision.aggregate';
import { ReplayRunDecisionVersionConflictError } from '@replays/domain/exceptions/replay-run-decision-version-conflict.error';
import type { ReplayRunDecisionRepository } from '@replays/domain/repositories/replay-run-decision.repository';
import { MovesOnWords } from '@replays/domain/value-objects/moves-on-words.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import {
  replay,
  replayRunDecision,
} from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, lt, notExists, type SQL } from 'drizzle-orm';

type DecisionRow = typeof replayRunDecision.$inferSelect;

const toDecision = (row: DecisionRow): ReplayRunDecision =>
  ReplayRunDecision.rehydrate({
    runId: RunId.of(row.runId),
    owner: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      replayId: ReplayId.of(row.replayId),
    },
    decided: row.decided,
    unreplayableReason: row.unreplayableReason,
    trial: row.movesOnAfter
      ? {
          fingerprint: row.trialFingerprint
            ? StationFingerprint.of(row.trialFingerprint)
            : null,
          movesOnAfter: MovesOnWords.of(row.movesOnAfter),
        }
      : null,
    version: row.version,
  });

const columnsOf = (decision: ReplayRunDecision) => ({
  decided: decision.decided,
  unreplayableReason: decision.unreplayableReason,
  trialFingerprint: decision.trial?.fingerprint?.value ?? null,
  movesOnAfter: decision.trial ? [...decision.trial.movesOnAfter.words] : null,
});

@Injectable()
export class DrizzleReplayRunDecisionRepository
  implements ReplayRunDecisionRepository
{
  constructor(private readonly context: DrizzleContext) {}

  async find(runId: RunId): Promise<ReplayRunDecision | null> {
    const [found] = await this.context.db
      .select()
      .from(replayRunDecision)
      .where(eq(replayRunDecision.runId, runId.value));

    return found ? toDecision(found) : null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly ReplayRunDecision[]> {
    const rows = await this.context.db
      .select()
      .from(replayRunDecision)
      .where(eq(replayRunDecision.teamId, teamId.value));

    return rows.map(toDecision);
  }

  async ofReplay(replayId: ReplayId): Promise<readonly ReplayRunDecision[]> {
    const rows = await this.context.db
      .select()
      .from(replayRunDecision)
      .where(eq(replayRunDecision.replayId, replayId.value));

    return rows.map(toDecision);
  }

  async ofDeletedReplays(
    decidedBefore: Date,
    limit: number,
  ): Promise<readonly ReplayRunDecision[]> {
    const rows = await this.context.db
      .select()
      .from(replayRunDecision)
      .where(
        and(
          lt(replayRunDecision.decidedAt, decidedBefore),
          notExists(
            this.context.db
              .select({ id: replay.id })
              .from(replay)
              .where(eq(replay.id, replayRunDecision.replayId)),
          ),
        ),
      )
      .orderBy(asc(replayRunDecision.decidedAt))
      .limit(limit);

    return rows.map(toDecision);
  }

  async add(decision: ReplayRunDecision): Promise<void> {
    const written = await this.context.db
      .insert(replayRunDecision)
      .values({
        runId: decision.runId.value,
        workspaceId: decision.owner.workspaceId.value,
        teamId: decision.owner.teamId.value,
        replayId: decision.owner.replayId.value,
        ...columnsOf(decision),
        version: decision.version,
      })
      .onConflictDoNothing({ target: replayRunDecision.runId })
      .returning({ runId: replayRunDecision.runId });

    if (written.length === 0) {
      throw new ReplayRunDecisionVersionConflictError(decision.runId);
    }
  }

  async save(decision: ReplayRunDecision): Promise<void> {
    const at = and(
      eq(replayRunDecision.runId, decision.runId.value),
      eq(replayRunDecision.version, decision.version),
    ) as SQL;
    const written = decision.isDeleted
      ? await this.context.db
          .delete(replayRunDecision)
          .where(at)
          .returning({ runId: replayRunDecision.runId })
      : await this.context.db
          .update(replayRunDecision)
          .set({ ...columnsOf(decision), version: decision.version + 1 })
          .where(at)
          .returning({ runId: replayRunDecision.runId });

    if (written.length === 0) {
      throw new ReplayRunDecisionVersionConflictError(decision.runId);
    }
  }
}
