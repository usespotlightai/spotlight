import type {
  FiredAlert,
  StationFactsPort,
  StationRuns,
  StationScores,
  StationsScores,
} from '@insights/application/ports/station-facts.port';
import {
  type ConfigIntervalBound,
  earliestBounds,
} from '@insights/domain/services/config-intervals';
import type { LocatedFailure } from '@insights/domain/services/failure-summaries';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import type { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';
import { firingOf } from '@insights/infrastructure/persistence/drizzle/mappers/alert-firing.mapper';
import { factOfRow } from '@insights/infrastructure/persistence/drizzle/mappers/run-fact.mapper';
import { scoreFactOfRow } from '@insights/infrastructure/persistence/drizzle/mappers/score.mapper';
import {
  runFact,
  score,
  stationAlert,
  stationAlertState,
  taskFailures,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { Injectable } from '@nestjs/common';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { inList } from '@platform/persistence/drizzle/in-list';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, desc, eq, type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const atStation = (runs: StationRuns): SQL | undefined =>
  and(
    eq(runFact.workspaceId, runs.workspaceId.value),
    eq(runFact.teamId, runs.teamId.value),
    eq(runFact.stationId, runs.stationId.value),
    runs.lineId === null ? undefined : eq(runFact.lineId, runs.lineId.value),
  );

const boundsOf = (earliest: readonly ConfigIntervalBound[]): SQL => {
  const stationIds = sql.join(
    earliest.map(({ stationId }) => sql`${stationId}`),
    sql`, `,
  );
  const froms = sql.join(
    earliest.map(({ from }) => sql`${from.toISOString()}`),
    sql`, `,
  );
  const fromRuns = sql.join(
    earliest.map(({ fromRun }) => sql`${fromRun?.value ?? ''}`),
    sql`, `,
  );

  return sql`unnest(array[${stationIds}]::text[], array[${froms}]::timestamptz[], array[${fromRuns}]::text[]) as bound(station_id, from_at, from_run)`;
};

const lastConfigRunBefore = (teamId: TeamId): SQL => {
  const seed = alias(runFact, 'seed');

  return sql`(
    select ${seed.runId} as run_id
    from ${runFact} ${seed}
    where ${seed.teamId} = ${teamId.value}
      and ${seed.stationId} = bound.station_id
      and ${seed.ranAConfig}
      and (${seed.beganAt} < bound.from_at or (${seed.beganAt} = bound.from_at and ${seed.runId} collate "C" < bound.from_run collate "C"))
    order by ${seed.beganAt} desc, ${seed.runId} collate "C" desc
    limit 1
  )`;
};

const judgedWhere = (criteria: {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
  readonly rubricVersion?: string;
}): SQL | undefined =>
  and(
    eq(score.workspaceId, criteria.workspaceId.value),
    eq(score.teamId, criteria.teamId.value),
    eq(score.lineId, criteria.lineId.value),
    eq(score.stationId, criteria.stationId.value),
    eq(score.source, 'judge'),
    criteria.rubricVersion === undefined
      ? undefined
      : eq(score.rubricVersion, criteria.rubricVersion),
  );

const ids = (runIds: readonly RunId[]): readonly string[] =>
  runIds.map((each) => each.value);

@Injectable()
export class DrizzleStationFacts implements StationFactsPort {
  constructor(private readonly context: DrizzleContext) {}

  async firedAlert(alertId: AlertId): Promise<FiredAlert | null> {
    const [row] = await this.context.db
      .select({ alert: stationAlert, station: stationAlertState })
      .from(stationAlert)
      .innerJoin(
        stationAlertState,
        eq(stationAlertState.stationId, stationAlert.stationId),
      )
      .where(eq(stationAlert.id, alertId.value))
      .limit(1);

    return row
      ? {
          station: {
            workspaceId: WorkspaceId.of(row.station.workspaceId),
            teamId: TeamId.of(row.station.teamId),
            lineId: LineId.of(row.station.lineId),
            stationId: StationId.of(row.station.stationId),
          },
          firing: firingOf(row.alert),
        }
      : null;
  }

  latestStartedAt(runs: StationRuns): Promise<readonly RunFact[]> {
    return this.facts((db) =>
      db
        .select()
        .from(runFact)
        .where(atStation(runs))
        .orderBy(desc(runFact.beganAt), sql`${runFact.runId} collate "C" desc`)
        .limit(runs.last),
    );
  }

  lastEndedAt(runs: StationRuns): Promise<readonly RunFact[]> {
    return this.facts((db) =>
      db
        .select()
        .from(runFact)
        .where(atStation(runs))
        .orderBy(desc(runFact.endedAt))
        .limit(runs.last),
    );
  }

  lastConfigRunsBefore(
    teamId: TeamId,
    bounds: readonly ConfigIntervalBound[],
  ): Promise<readonly RunFact[]> {
    const earliest = [...earliestBounds(bounds).values()];

    if (earliest.length === 0) {
      return Promise.resolve([]);
    }

    return this.facts((db) =>
      db
        .select()
        .from(runFact)
        .where(
          sql`${runFact.runId} in (
            select previous.run_id
            from ${boundsOf(earliest)}
            join lateral ${lastConfigRunBefore(teamId)} previous on true
          )`,
        ),
    );
  }

  ofRuns(runIds: readonly RunId[]): Promise<readonly RunFact[]> {
    if (runIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.facts((db) =>
      db
        .select()
        .from(runFact)
        .where(inList(runFact.runId, ids(runIds))),
    );
  }

  ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunFact[]> {
    if (taskIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.facts((db) =>
      db
        .select()
        .from(runFact)
        .where(
          inList(
            runFact.taskId,
            taskIds.map((each) => each.value),
          ),
        ),
    );
  }

  async failuresOfRuns(
    runIds: readonly RunId[],
  ): Promise<readonly LocatedFailure[]> {
    if (runIds.length === 0) {
      return [];
    }

    const wanted = new Set(ids(runIds));
    const rows = await this.read((db) =>
      db
        .select({
          taskId: taskFailures.taskId,
          occurrences: taskFailures.occurrences,
        })
        .from(taskFailures)
        .where(
          sql`exists (select 1 from jsonb_array_elements(${taskFailures.occurrences}) as occurrence where occurrence->>'runId' = any(${sql`array[${sql.join(
            [...wanted].map((each) => sql`${each}`),
            sql`, `,
          )}]::text[]`}))`,
        )
        .orderBy(asc(taskFailures.taskId)),
    );

    return rows.flatMap((row) =>
      row.occurrences
        .filter((each) => each.runId !== null && wanted.has(each.runId))
        .map((each) => ({
          taskId: row.taskId,
          occurrence: FailureOccurrence.of({
            ...each,
            stationId: StationId.of(each.stationId),
            at: new Date(each.at),
          }),
        })),
    );
  }

  async scoresOfRuns(runIds: readonly RunId[]): Promise<readonly ScoreFact[]> {
    if (runIds.length === 0) {
      return [];
    }

    const rows = await this.read((db) =>
      db
        .select()
        .from(score)
        .where(inList(score.runId, ids(runIds))),
    );

    return rows.map(scoreFactOfRow);
  }

  async judgedAtStation(
    criteria: StationScores,
  ): Promise<readonly ScoreFact[]> {
    const rows = await this.read((db) =>
      db
        .select()
        .from(score)
        .where(judgedWhere(criteria))
        .orderBy(desc(score.at), desc(score.id))
        .limit(criteria.last),
    );

    return rows.map(scoreFactOfRow);
  }

  async judgedAtStations(
    criteria: StationsScores,
  ): Promise<readonly ScoreFact[]> {
    const stations = [
      ...new Map(
        criteria.stations.map((each) => [
          JSON.stringify([each.lineId, each.stationId, each.rubricVersion]),
          each,
        ]),
      ).values(),
    ];

    if (stations.length === 0) {
      return [];
    }

    const picked = sql.join(
      stations.map(
        (each) =>
          sql`(select ${score.id} from ${score} where ${judgedWhere({ ...criteria, ...each })} order by ${score.at} desc, ${score.id} desc limit ${criteria.last})`,
      ),
      sql` union all `,
    );
    const rows = await this.read((db) =>
      db.select().from(score).where(sql`${score.id} in (${picked})`),
    );

    return rows.map(scoreFactOfRow);
  }

  private read<T>(query: (db: DrizzleDatabase) => Promise<T>): Promise<T> {
    return query(this.context.db);
  }

  private async facts(
    query: (db: DrizzleDatabase) => Promise<(typeof runFact.$inferSelect)[]>,
  ): Promise<readonly RunFact[]> {
    return (await this.read(query)).map(factOfRow);
  }
}
