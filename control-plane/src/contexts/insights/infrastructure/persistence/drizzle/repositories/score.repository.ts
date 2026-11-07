import { Score } from '@insights/domain/aggregates/score.aggregate';
import { ScoreVersionConflictError } from '@insights/domain/exceptions/score-version-conflict.error';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { inScope } from '@insights/infrastructure/persistence/drizzle/deletion-scope.sql';
import {
  scoreFieldsOfRow,
  storedCitation,
} from '@insights/infrastructure/persistence/drizzle/mappers/score.mapper';
import {
  type StoredReason,
  score,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { and, eq } from 'drizzle-orm';

type ScoreRow = typeof score.$inferSelect;

const toScore = (row: ScoreRow): Score =>
  Score.rehydrate(scoreFieldsOfRow(row));

const columnsOf = (stored: Score) => ({
  kind: stored.scale.kind,
  value: stored.value,
  claimResults: stored.claimResults && [...stored.claimResults],
  rubricVersion: stored.rubricVersion,
  at: stored.at,
});

const storedReasons = (stored: Score): StoredReason[] =>
  stored.reasons.map((each) => ({
    text: each.text,
    citations: each.citations.map(storedCitation),
    claim: each.claim,
  }));

@Injectable()
export class DrizzleScoreRepository implements ScoreRepository {
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async add(added: Score): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(score)
        .values({
          id: added.id.value,
          runId: added.runId.value,
          workspaceId: added.workspaceId.value,
          teamId: added.location.teamId.value,
          lineId: added.location.lineId.value,
          stationId: added.location.stationId.value,
          taskId: added.location.taskId.value,
          fingerprint: added.fingerprint,
          source: added.source,
          model: added.model,
          reasons: storedReasons(added),
          seen: { steps: added.seen.steps, hunks: added.seen.hunks },
          scoredById: added.by?.value ?? null,
          version: added.version,
          ...columnsOf(added),
        })
        .onConflictDoNothing()
        .returning({ id: score.id });

      if (written.length === 0) {
        throw new ScoreVersionConflictError(added.id.value);
      }

      await this.events.dispatch(added.pullEvents());
    });
  }

  async save(saved: Score): Promise<void> {
    await this.context.inTransaction(async () => {
      const written = await this.context.db
        .update(score)
        .set({ version: saved.version + 1, ...columnsOf(saved) })
        .where(
          and(eq(score.id, saved.id.value), eq(score.version, saved.version)),
        )
        .returning({ id: score.id });

      if (written.length === 0) {
        throw new ScoreVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  async judgeOf(
    runId: RunId,
    rubricVersion: RubricVersion,
  ): Promise<Score | null> {
    const [row] = await this.context.db
      .select()
      .from(score)
      .where(
        and(
          eq(score.runId, runId.value),
          eq(score.source, 'judge'),
          eq(score.rubricVersion, rubricVersion),
        ),
      )
      .limit(1);

    return row ? toScore(row) : null;
  }

  async gradeBy(runId: RunId, by: UserId): Promise<Score | null> {
    const [row] = await this.context.db
      .select()
      .from(score)
      .where(
        and(
          eq(score.runId, runId.value),
          eq(score.source, 'person'),
          eq(score.scoredById, by.value),
        ),
      )
      .limit(1);

    return row ? toScore(row) : null;
  }

  async ofRuns(runIds: readonly RunId[]): Promise<readonly Score[]> {
    if (runIds.length === 0) {
      return [];
    }

    const rows = await this.context.db
      .select()
      .from(score)
      .where(
        inList(
          score.runId,
          runIds.map((each) => each.value),
        ),
      );

    return rows.map(toScore);
  }

  async remove(removed: Score): Promise<void> {
    const gone = await this.context.db
      .delete(score)
      .where(
        and(eq(score.id, removed.id.value), eq(score.version, removed.version)),
      )
      .returning({ id: score.id });

    if (gone.length === 0) {
      throw new ScoreVersionConflictError(removed.id.value);
    }
  }

  async ofScope(scope: DeletionScope, max: number): Promise<readonly Score[]> {
    const rows = await this.context.db
      .select()
      .from(score)
      .where(inScope(score, scope))
      .limit(max);

    return rows.map(toScore);
  }
}
