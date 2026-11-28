import { InsightsPeriod } from '@insights/domain/value-objects/insights-period.vo';
import {
  stationCountsIn,
  teamCountsIn,
} from '@insights/infrastructure/persistence/drizzle/readers/insights/station-counts.sql';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

const TEAM = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  period: InsightsPeriod.of('7d', new Date('2026-11-27T00:00:00.000Z')),
};

const groupedQueriesOf = async (
  read: (db: DrizzleDatabase) => Promise<unknown>,
): Promise<readonly string[]> => {
  const dialect = new PgDialect();
  const queries: string[] = [];
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- reads the SQL it is asked to run
  const db = {
    execute: async (query: SQL) => {
      queries.push(dialect.sqlToQuery(query).sql);
      return { rows: [] };
    },
  } as unknown as DrizzleDatabase;

  await read(db);

  return queries.filter((each) => each.includes('grouping sets'));
};

const groupingSetsOf = (query: string): string =>
  /group by grouping sets \(([\s\S]*?)\)\s*having/.exec(query)?.[1] ?? '';

const selectedColumnsOf = (query: string): readonly string[] =>
  [
    ...(/select([\s\S]*?)count\(/.exec(query)?.[1] ?? '').matchAll(
      /^\s*("run_fact"\."[a-z_]+") as /gm,
    ),
  ].map(([, column]) => column);

const groupedColumnsOf = (query: string): readonly string[] =>
  [...query.matchAll(/grouping\(("run_fact"\."[a-z_]+")\)/g)].map(
    ([, column]) => column,
  );

describe('the tallies of a team’s runs', () => {
  it.each([
    ['the team alone', (db: DrizzleDatabase) => teamCountsIn(db, TEAM)],
    [
      'each station, every run',
      (db: DrizzleDatabase) => stationCountsIn(db, TEAM),
    ],
    [
      'each station, its own work only',
      (db: DrizzleDatabase) => stationCountsIn(db, TEAM, 'station-work'),
    ],
  ])(
    'select and test for grouping only what they group by, for %s',
    async (_name, read) => {
      const queries = await groupedQueriesOf(read);

      expect(queries).toHaveLength(1);

      for (const query of queries) {
        const sets = groupingSetsOf(query);

        expect(sets).not.toBe('');
        for (const column of [
          ...selectedColumnsOf(query),
          ...groupedColumnsOf(query),
        ]) {
          expect(sets, column).toContain(column);
        }
      }
    },
  );
});
