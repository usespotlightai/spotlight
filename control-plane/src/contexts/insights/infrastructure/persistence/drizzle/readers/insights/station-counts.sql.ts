import type { TeamInPeriod } from '@insights/application/ports/insights-reader.port';
import { NO_RUNS, type TallyCounts } from '@insights/domain/services/run-tally';
import type {
  FailingTask,
  StationCounts,
  TeamCounts,
  WindowCounts,
} from '@insights/domain/services/station-reports';
import { FailureOccurrence } from '@insights/domain/value-objects/failure-occurrence.vo';
import type { Window } from '@insights/domain/value-objects/insights-period.vo';
import {
  asUtc,
  day,
  endedIn,
  factsInPeriod,
  inEndOrder,
  isCurrent,
  iso,
  onTeam,
  type StationRow,
  stationsInEndOrder,
  type TallyColumns,
  tallyColumns,
  tallyCountsOf,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import {
  runFact,
  type StoredOccurrence,
  taskFailures,
  taskHumanAction,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { sql } from 'drizzle-orm';

interface TallyRow extends TallyColumns, Record<string, unknown> {
  readonly is_current: boolean;
  readonly station_id: string | null;
  readonly day: string | null;
  readonly all_stations: number;
  readonly all_days: number;
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

class WindowTallies {
  #current: TallyCounts | null = null;
  #previous: TallyCounts | null = null;
  readonly #byDay = new Map<string, TallyCounts>();

  add(row: TallyRow): void {
    if (row.all_days === 0 && row.day !== null) {
      if (row.is_current) {
        this.#byDay.set(row.day, tallyCountsOf(row));
      }
    } else if (row.is_current) {
      this.#current = tallyCountsOf(row);
    } else {
      this.#previous = tallyCountsOf(row);
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
        ${tallyColumns}
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
  const result = await db.execute<StationRow>(
    stationsInEndOrder(
      sql`
        select ${runFact}.* from ${runFact}
        where ${onTeam(team)} and ${endedIn(current.from, current.to)}`,
    ),
  );

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
        ${taskHumanAction.lineId} as line_id,
        occurrence.value as occurrence
      from ${taskFailures}
      cross join lateral jsonb_array_elements(${taskFailures.occurrences})
        with ordinality as occurrence(value, position)
      left join ${taskHumanAction} on ${taskHumanAction.taskId} = ${taskFailures.taskId}
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
      teamTallies.add(row);
    } else if (row.station_id !== null) {
      const windowTallies =
        stationTallies.get(row.station_id) ?? new WindowTallies();
      windowTallies.add(row);
      stationTallies.set(row.station_id, windowTallies);
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
