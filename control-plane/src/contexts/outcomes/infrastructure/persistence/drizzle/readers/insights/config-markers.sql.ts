import type { TeamInPeriod } from '@outcomes/application/ports/insights-reader.port';
import type { Window } from '@outcomes/domain/value-objects/insights-period.vo';
import {
  iso,
  onTeam,
} from '@outcomes/infrastructure/persistence/drizzle/readers/insights/run-fact.sql';
import { runFact } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { type SQL, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export const precedes = (at: SQL, run: SQL, thenAt: SQL, thenRun: SQL): SQL =>
  sql`(${at} < ${thenAt} or (${at} = ${thenAt} and ${run} collate "C" < ${thenRun} collate "C"))`;

export const configMarkers = (team: TeamInPeriod, began: Window): SQL => {
  const earlier = alias(runFact, 'earlier');
  const configRun = (of: typeof runFact | typeof earlier): SQL =>
    sql`${of.ran} and ${of.startedAt} is not null and ${of.fingerprint} is not null`;

  return sql`
    select
      ${runFact.lineId} as line_id,
      ${runFact.stationId} as station_id,
      ${runFact.fingerprint} as fingerprint,
      previous.fingerprint as previous_fingerprint,
      ${runFact.beganAt} as began_at,
      ${runFact.runId} as run_id
    from ${runFact}
    cross join lateral (
      select ${earlier.fingerprint} as fingerprint
      from ${runFact} as ${earlier}
      where ${earlier.workspaceId} = ${runFact.workspaceId}
        and ${earlier.teamId} = ${runFact.teamId}
        and ${earlier.stationId} = ${runFact.stationId}
        and ${configRun(earlier)}
        and ${precedes(sql`${earlier.beganAt}`, sql`${earlier.runId}`, sql`${runFact.beganAt}`, sql`${runFact.runId}`)}
      order by ${earlier.beganAt} desc, ${earlier.runId} collate "C" desc
      limit 1
    ) as previous
    where ${onTeam(team)}
      and ${configRun(runFact)}
      and ${runFact.beganAt} >= ${iso(began.from)}::timestamp
      and ${runFact.beganAt} < ${iso(began.to)}::timestamp
      and previous.fingerprint <> ${runFact.fingerprint}`;
};
