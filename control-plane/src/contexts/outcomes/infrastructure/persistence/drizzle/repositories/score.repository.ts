import { Inject, Injectable } from '@nestjs/common';
import { Score } from '@outcomes/domain/aggregates/score.aggregate';
import { ScoreVersionConflictError } from '@outcomes/domain/exceptions/score-version-conflict.error';
import type {
  ScoreRepository,
  StationScores,
  StationsScores,
} from '@outcomes/domain/repositories/score.repository';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import {
  type StoredCitation,
  type StoredReason,
  score,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, type SQL, sql } from 'drizzle-orm';

type ScoreRow = typeof score.$inferSelect;

const citationOf = (stored: StoredCitation): Citation => {
  if (stored.hunk !== null) {
    return Citation.ofHunk(stored.hunk);
  }
  if (stored.step === null) {
    throw new InconsistentStateError(
      'score',
      'cites neither a step nor a hunk',
    );
  }

  return Citation.ofStep(stored.step);
};

const storedCitation = (citation: Citation): StoredCitation => ({
  step: citation.step,
  hunk: citation.hunk,
});

const toScore = (row: ScoreRow): Score =>
  Score.rehydrate({
    id: ScoreId.of(row.id),
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    place: RunPlace.of({
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
      taskId: TaskId.of(row.taskId),
    }),
    fingerprint: row.fingerprint,
    source: row.source,
    scale: ScoreScale.of(row.kind),
    value: row.value,
    marks: row.marks,
    rubricVersion: row.rubricVersion,
    model: row.model,
    reasons: row.reasons.map((each) =>
      JudgeReason.of({
        text: each.text,
        citations: each.citations.map(citationOf),
        claim: each.claim,
      }),
    ),
    seen: SeenEvidence.of(row.seen),
    by: row.by ? UserId.of(row.by) : null,
    at: row.at,
    version: row.version,
  });

const columnsOf = (stored: Score) => ({
  kind: stored.scale.kind,
  value: stored.value,
  marks: stored.marks && [...stored.marks],
  rubricVersion: stored.rubricVersion,
  at: stored.at,
});

const storedReasons = (stored: Score): StoredReason[] =>
  stored.reasons.map((each) => ({
    text: each.text,
    citations: each.citations.map(storedCitation),
    claim: each.claim,
  }));

const judgedWhere = (criteria: {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: string;
  readonly stationId: string;
  readonly rubricVersion?: string;
}): SQL | undefined =>
  and(
    eq(score.workspaceId, criteria.workspaceId.value),
    eq(score.teamId, criteria.teamId.value),
    eq(score.lineId, criteria.lineId),
    eq(score.stationId, criteria.stationId),
    eq(score.source, 'judge'),
    criteria.rubricVersion === undefined
      ? undefined
      : eq(score.rubricVersion, criteria.rubricVersion),
  );

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
          teamId: added.place.teamId.value,
          lineId: added.place.lineId,
          stationId: added.place.stationId,
          taskId: added.place.taskId.value,
          fingerprint: added.fingerprint,
          source: added.source,
          model: added.model,
          reasons: storedReasons(added),
          seen: { steps: added.seen.steps, hunks: added.seen.hunks },
          by: added.by?.value ?? null,
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

  async judgeOf(runId: RunId, rubricVersion: string): Promise<Score | null> {
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
          eq(score.by, by.value),
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

  async judgedAtStation(criteria: StationScores): Promise<readonly Score[]> {
    const rows = await this.context.db
      .select()
      .from(score)
      .where(judgedWhere(criteria))
      .orderBy(desc(score.at), desc(score.id))
      .limit(criteria.last);

    return rows.map(toScore);
  }

  async judgedAtStations(criteria: StationsScores): Promise<readonly Score[]> {
    const asked = [
      ...new Map(
        criteria.stations.map((each) => [
          JSON.stringify([each.lineId, each.stationId, each.rubricVersion]),
          each,
        ]),
      ).values(),
    ];

    if (asked.length === 0) {
      return [];
    }

    const picked = sql.join(
      asked.map(
        (each) =>
          sql`(select ${score.id} from ${score} where ${judgedWhere({ ...criteria, ...each })} order by ${score.at} desc, ${score.id} desc limit ${criteria.last})`,
      ),
      sql` union all `,
    );
    const rows = await this.context.db
      .select()
      .from(score)
      .where(sql`${score.id} in (${picked})`);

    return rows.map(toScore);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    await this.context.db.delete(score).where(eq(score.taskId, taskId.value));
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(score)
      .where(
        and(
          eq(score.workspaceId, workspaceId.value),
          eq(score.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(score)
      .where(eq(score.workspaceId, workspaceId.value));
  }
}
