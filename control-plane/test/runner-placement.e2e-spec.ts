import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { placementMet } from '@platform/persistence/drizzle/placement-met';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { RunningImage } from '@shared-kernel/domain/value-objects/running-image.vo';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type TestDatabase } from './support/database';

let database: TestDatabase;
let db: DrizzleDatabase;

beforeAll(async () => {
  database = await openDatabase('runner_placement');
  db = database.db;
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const WIDGETS = 'ghcr.io/acme/widgets:1';
const GADGETS = `ghcr.io/acme/gadgets@sha256:${'d'.repeat(64)}`;

const CLAUSES: readonly (readonly (readonly string[])[])[] = [
  [],
  [['gpu']],
  [['vpc-internal', 'build-1']],
  [['vpc-a', 'build-1'], ['gpu']],
  [['vpc-a'], ['vpc-b'], ['gpu', 'pod-a']],
];

const IMAGES: readonly (string | null)[] = [null, WIDGETS, GADGETS];

const LABELS: readonly (readonly string[])[] = [
  [],
  ['pod-a'],
  ['gpu'],
  ['build-1', 'gpu'],
  ['vpc-a', 'gpu'],
  ['vpc-a', 'vpc-b', 'pod-a'],
  ['laptop', 'vpc-internal'],
];

const RUNNING: readonly (RunningImage | null)[] = [
  null,
  RunningImage.of(RunnerImage.of(WIDGETS), true),
  RunningImage.of(RunnerImage.of(WIDGETS), false),
  RunningImage.of(RunnerImage.of(GADGETS), false),
];

const admittedInSql = async (
  clauses: readonly (readonly string[])[],
  image: string | null,
  terms: RunnerTerms,
): Promise<boolean> => {
  const answered = await db.execute<{ admitted: boolean }>(
    sql`SELECT ${placementMet(
      sql`${JSON.stringify(clauses)}::jsonb`,
      sql`${image}::text`,
      terms,
    )} AS admitted`,
  );

  return answered.rows[0]?.admitted === true;
};

const described = (
  clauses: readonly (readonly string[])[],
  image: string | null,
  terms: RunnerTerms,
): string =>
  `${JSON.stringify(clauses)} in ${image ?? 'the usual image'} / ${JSON.stringify(
    terms.values,
  )} running ${
    terms.running
      ? `${terms.running.image.value}${terms.running.usual ? ' (usual)' : ''}`
      : 'nothing named'
  }`;

describe('placement said in SQL', () => {
  it('admits exactly the runners RunnerPlacement admits', async () => {
    const disagreements: string[] = [];

    for (const clauses of CLAUSES) {
      for (const image of IMAGES) {
        const placement = RunnerPlacement.ofClauses(
          clauses,
          image ? RunnerImage.of(image) : null,
        );

        for (const labels of LABELS) {
          for (const running of RUNNING) {
            const terms = RunnerTerms.of(labels).runningIn(running);

            if (
              (await admittedInSql(clauses, image, terms)) !==
              placement.admits(terms)
            ) {
              disagreements.push(described(clauses, image, terms));
            }
          }
        }
      }
    }

    expect(disagreements).toEqual([]);
  });

  it('claims work naming an image only for a runner running that image, and work naming none only for one running the usual image', async () => {
    const widgets = RunnerImage.of(WIDGETS);
    const usual = RunnerTerms.none().runningIn(RunningImage.of(widgets, true));
    const offered = RunnerTerms.none().runningIn(
      RunningImage.of(RunnerImage.of(GADGETS), false),
    );

    expect(await admittedInSql([], WIDGETS, usual)).toBe(true);
    expect(await admittedInSql([], WIDGETS, offered)).toBe(false);
    expect(await admittedInSql([], GADGETS, offered)).toBe(true);
    expect(await admittedInSql([], null, usual)).toBe(true);
    expect(await admittedInSql([], null, offered)).toBe(false);
  });
});
