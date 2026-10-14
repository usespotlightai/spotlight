import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import { NO_RUNS, type TallyCounts } from '@outcomes/domain/services/run-tally';
import type {
  FailingTask,
  StationCounts,
  TeamCounts,
  WindowCounts,
} from '@outcomes/domain/services/station-reports';
import { FailureOccurrence } from '@outcomes/domain/value-objects/failure-occurrence.vo';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import {
  asUtc,
  counted,
  day,
  endedIn,
  factsInPeriod,
  inEndOrder,
  isCurrent,
  iso,
  medianOver,
  onTeam,
  p90Over,
  ran,
  type SpendRow,
  spendColumns,
  spendOf,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  runFact,
  type StoredOccurrence,
  taskFailures,
  taskTouches,
} from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { sql } from 'drizzle-orm';

interface TallyRow extends SpendRow, Record<string, unknown> {
  readonly is_current: boolean;
  readonly station_id: string | null;
  readonly day: string | null;
  readonly all_stations: number;
  readonly all_days: number;
  readonly runs: number;
  readonly withdrawn: number;
  readonly failed: number;
  readonly stopped: number;
  readonly checks_passed: number;
  readonly checks_failed: number;
  readonly accepted: number;
  readonly sent_back: number;
  readonly handed_on: number;
  readonly merged: number;
  readonly median_ms: number | null;
  readonly p90_ms: number | null;
}

interface StationRow extends Record<string, unknown> {
  readonly station_id: string;
  readonly line_id: string;
}

interface RunFailureRow extends Record<string, unknown> {
  readonly station_id: string;
  readonly failure: string | null;
  readonly run_ids: string[];
}

interface FailingRow extends Record<string, unknown> {
  readonly task_id: string;
  readonly line_id: string | null;
  readonly occurrence: StoredOccurrence;
}

const timed = sql`${ran} and ${runFact.ms} is not null`;

const countsOf = (row: TallyRow): TallyCounts => ({
  runs: row.runs,
  withdrawn: row.withdrawn,
  failed: row.failed,
  stopped: row.stopped,
  checksPassed: row.checks_passed,
  checksFailed: row.checks_failed,
  accepted: row.accepted,
  sentBack: row.sent_back,
  handedOn: row.handed_on,
  merged: row.merged,
  cost: spendOf(row),
  unpriced: row.unpriced,
  mixedCurrencies: row.currencies > 1,
  medianMs: row.median_ms,
  p90Ms: row.p90_ms,
});

class WindowTallies {
  #current: TallyCounts | null = null;
  #previous: TallyCounts | null = null;
  readonly #byDay = new Map<string, TallyCounts>();

  hold(row: TallyRow): void {
    if (row.all_days === 0 && row.day !== null) {
      if (row.is_current) {
        this.#byDay.set(row.day, countsOf(row));
      }
    } else if (row.is_current) {
      this.#current = countsOf(row);
    } else {
      this.#previous = countsOf(row);
    }
  }

  counts(): WindowCounts {
    return {
      current: this.#current ?? NO_RUNS,
      previous: this.#previous ?? NO_RUNS,
      byDay: this.#byDay,
    };
  }
}

const talliesIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly TallyRow[]> => {
  const result = await db.execute<TallyRow>(sql`
      select
        ${isCurrent} as is_current,
        ${runFact.stationId} as station_id,
        ${day} as day,
        grouping(${runFact.stationId})::int as all_stations,
        grouping(${day})::int as all_days,
        ${counted(ran)} as runs,
        ${counted(sql`not ${ran}`)} as withdrawn,
        ${counted(sql`${ran} and ${runFact.supersededAt} is null and ${runFact.ending} = 'failed'`)} as failed,
        ${counted(sql`${ran} and ${runFact.supersededAt} is null and ${runFact.ending} = 'stopped'`)} as stopped,
        ${counted(sql`${ran} and ${runFact.checks} = 'passed'`)} as checks_passed,
        ${counted(sql`${ran} and ${runFact.checks} = 'failed'`)} as checks_failed,
        ${counted(sql`${ran} and ${runFact.nextAct} = 'closed'`)} as accepted,
        ${counted(sql`${ran} and ${runFact.nextAct} = 'sent-back'`)} as sent_back,
        ${counted(sql`${ran} and ${runFact.handedOnTo} is not null`)} as handed_on,
        count(distinct ${runFact.taskId}) filter (where ${ran} and ${runFact.deliveryState} = 'merged')::int as merged,
        ${spendColumns},
        ${medianOver(sql`${runFact.ms}`, timed)} as median_ms,
        ${p90Over(sql`${runFact.ms}`, timed)} as p90_ms
      from ${factsInPeriod(team)}
      group by grouping sets (
        (${isCurrent}),
        (${isCurrent}, ${day}),
        (${isCurrent}, ${runFact.stationId}),
        (${isCurrent}, ${runFact.stationId}, ${day})
      )
      having ${isCurrent} or grouping(${day}) = 1
    `);

  return result.rows;
};

const stationsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly StationRow[]> => {
  const { current } = team.period;
  const result = await db.execute<StationRow>(sql`
      select station_id, line_id from (
        select distinct on (${runFact.stationId})
          ${runFact.stationId} as station_id,
          ${runFact.lineId} as line_id,
          ${runFact.endedAt} as ended_at,
          ${runFact.runId} as run_id
        from ${runFact}
        where ${onTeam(team)} and ${endedIn(current.from, current.to)}
        order by ${runFact.stationId}, ${inEndOrder}
      ) as first
      order by ended_at, run_id collate "C"
    `);

  return result.rows;
};

const runFailuresIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<readonly RunFailureRow[]> => {
  const { current } = team.period;
  const result = await db.execute<RunFailureRow>(sql`
      select
        ${runFact.stationId} as station_id,
        ${runFact.failure} as failure,
        array_agg(${runFact.runId} order by ${inEndOrder}) as run_ids
      from ${runFact}
      where ${onTeam(team)}
        and ${endedIn(current.from, current.to)}
        and ${runFact.supersededAt} is null
        and ${runFact.ending} = 'failed'
      group by ${runFact.stationId}, ${runFact.failure}
      order by
        count(*) desc,
        min(${runFact.endedAt}),
        (array_agg(${runFact.runId} order by ${inEndOrder}))[1] collate "C"
    `);

  return result.rows;
};

export const failingIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
  window: Window,
): Promise<readonly FailingTask[]> => {
  const at = sql`(occurrence.value->>'at')::timestamptz`;
  const result = await db.execute<FailingRow>(sql`
      select
        ${taskFailures.taskId} as task_id,
        ${taskTouches.lineId} as line_id,
        occurrence.value as occurrence
      from ${taskFailures}
      cross join lateral jsonb_array_elements(${taskFailures.occurrences})
        with ordinality as occurrence(value, position)
      left join ${taskTouches} on ${taskTouches.taskId} = ${taskFailures.taskId}
      where ${taskFailures.workspaceId} = ${team.workspaceId.value}
        and ${taskFailures.teamId} = ${team.teamId.value}
        and ${taskFailures.lastAt} >= ${iso(window.from)}::timestamp
        and ${at} >= ${asUtc(window.from)}
        and ${at} < ${asUtc(window.to)}
      order by ${taskFailures.lastAt} desc, ${taskFailures.taskId} desc, occurrence.position
    `);

  return result.rows.map((row) => ({
    taskId: row.task_id,
    lineId: row.line_id,
    occurrence: FailureOccurrence.of({
      ...row.occurrence,
      at: new Date(row.occurrence.at),
    }),
  }));
};

export const stationCountsIn = async (
  db: DrizzleDatabase,
  team: TeamInPeriod,
): Promise<TeamCounts> => {
  const tallies = await talliesIn(db, team);
  const stations = await stationsIn(db, team);
  const runFailures = await runFailuresIn(db, team);
  const failing = await failingIn(db, team, team.period.current);
  const teamTallies = new WindowTallies();
  const stationTallies = new Map<string, WindowTallies>();

  for (const row of tallies) {
    if (row.all_stations === 1) {
      teamTallies.hold(row);
    } else if (row.station_id !== null) {
      const held = stationTallies.get(row.station_id) ?? new WindowTallies();
      held.hold(row);
      stationTallies.set(row.station_id, held);
    }
  }

  return {
    team: teamTallies.counts(),
    stations: stations.map(
      (station): StationCounts => ({
        lineId: station.line_id,
        stationId: station.station_id,
        ...(
          stationTallies.get(station.station_id) ?? new WindowTallies()
        ).counts(),
        runFailures: runFailures
          .filter((each) => each.station_id === station.station_id)
          .map((each) => ({
            failure: each.failure,
            runs: each.run_ids.length,
            runIds: each.run_ids,
          })),
      }),
    ),
    failing,
  };
};
