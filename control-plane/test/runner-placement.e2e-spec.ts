import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { everyClauseMet } from '@platform/persistence/drizzle/every-clause-met';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

let held: TestDatabase;
let db: DrizzleDatabase;

beforeAll(async () => {
  held = await openDatabase('runner_placement');
  db = held.db;
}, 60_000);

afterAll(async () => {
  await held?.close();
});

const PLACEMENTS: readonly (readonly (readonly string[])[])[] = [
  [],
  [['gpu']],
  [['vpc-internal', 'build-1']],
  [['vpc-a', 'build-1'], ['gpu']],
  [['vpc-a'], ['vpc-b'], ['gpu', 'pod-a']],
];

const TERMS: readonly (readonly string[])[] = [
  [],
  ['pod-a'],
  ['gpu'],
  ['build-1', 'gpu'],
  ['vpc-a', 'gpu'],
  ['vpc-a', 'vpc-b', 'pod-a'],
  ['laptop', 'vpc-internal'],
];

const admittedInSql = async (
  clauses: readonly (readonly string[])[],
  terms: readonly string[],
): Promise<boolean> => {
  const answered = await db.execute<{ admitted: boolean }>(
    sql`SELECT ${everyClauseMet(
      sql`${JSON.stringify(clauses)}::jsonb`,
      terms,
    )} AS admitted`,
  );

  return answered.rows[0]?.admitted === true;
};

describe('placement said in SQL', () => {
  it('admits exactly the runners RunnerPlacement admits', async () => {
    const disagreements: string[] = [];

    for (const clauses of PLACEMENTS) {
      for (const terms of TERMS) {
        const domain = RunnerPlacement.ofClauses(clauses).admits(
          RunnerTerms.of(terms),
        );

        if ((await admittedInSql(clauses, terms)) !== domain) {
          disagreements.push(
            `${JSON.stringify(clauses)} / ${JSON.stringify(terms)}`,
          );
        }
      }
    }

    expect(disagreements).toEqual([]);
  });
});
