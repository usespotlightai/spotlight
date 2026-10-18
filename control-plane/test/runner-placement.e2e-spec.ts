import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { placementMatches } from '@platform/persistence/drizzle/placement-matches';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
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

const LABEL_GROUPS: readonly (readonly (readonly string[])[])[] = [
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

const matchesInSql = async (
  labelGroups: readonly (readonly string[])[],
  image: string | null,
  offer: RunnerOffer,
): Promise<boolean> => {
  const answered = await db.execute<{ matches: boolean }>(
    sql`SELECT ${placementMatches(
      sql`${JSON.stringify(labelGroups)}::jsonb`,
      sql`${image}::text`,
      offer,
    )} AS matches`,
  );

  return answered.rows[0]?.matches === true;
};

const described = (
  labelGroups: readonly (readonly string[])[],
  image: string | null,
  offer: RunnerOffer,
): string =>
  `${JSON.stringify(labelGroups)} in ${image ?? 'the default image'} / ${JSON.stringify(
    offer.values,
  )} running ${
    offer.running
      ? `${offer.running.image.value}${offer.running.isDefault ? ' (default)' : ''}`
      : 'nothing named'
  }`;

describe('placement said in SQL', () => {
  it('matches exactly the runners RunnerPlacement matches', async () => {
    const disagreements: string[] = [];

    for (const labelGroups of LABEL_GROUPS) {
      for (const image of IMAGES) {
        const placement = RunnerPlacement.ofLabelGroups(
          labelGroups,
          image ? RunnerImage.of(image) : null,
        );

        for (const labels of LABELS) {
          for (const running of RUNNING) {
            const offer = RunnerOffer.of(labels).runningIn(running);

            if (
              (await matchesInSql(labelGroups, image, offer)) !==
              placement.matches(offer)
            ) {
              disagreements.push(described(labelGroups, image, offer));
            }
          }
        }
      }
    }

    expect(disagreements).toEqual([]);
  });

  it('claims work naming an image only for a runner running that image, and work naming none only for one running the default image', async () => {
    const widgets = RunnerImage.of(WIDGETS);
    const inDefaultImage = RunnerOffer.none().runningIn(
      RunningImage.of(widgets, true),
    );
    const offered = RunnerOffer.none().runningIn(
      RunningImage.of(RunnerImage.of(GADGETS), false),
    );

    expect(await matchesInSql([], WIDGETS, inDefaultImage)).toBe(true);
    expect(await matchesInSql([], WIDGETS, offered)).toBe(false);
    expect(await matchesInSql([], GADGETS, offered)).toBe(true);
    expect(await matchesInSql([], null, inDefaultImage)).toBe(true);
    expect(await matchesInSql([], null, offered)).toBe(false);
  });
});
