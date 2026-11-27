import type {
  DiffFacts,
  FileClass,
  HunkFacts,
} from '@change-review/domain/services/diff-facts';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import type {
  ProposedCohort,
  ProposedLayer,
  ProposedQuestion,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';
import { firstOf } from '@shared-kernel/domain/item-at';
import fc from 'fast-check';

const SYMBOLS = ['Invite', 'Team', 'zod', 'Queue', 'Lease'];

const KINDS = [
  'lockfile',
  'generated',
  'snapshot',
  'formatting',
  'renamed',
] as const;

type FileKind = 'source' | (typeof KINDS)[number];

const CLASSES: Record<FileKind, FileClass> = {
  source: 'source',
  lockfile: 'lockfile',
  generated: 'generated',
  snapshot: 'snapshot',
  formatting: 'source',
  renamed: 'source',
};

export interface DrawnFile {
  readonly hunks: number;
  readonly kind: FileKind;
}

export interface ProposedStack {
  readonly files: readonly DrawnFile[];
  readonly diff: Diff;
  readonly facts: DiffFacts;
  readonly cohorts: readonly ProposedCohort[];
}

export interface CohortInDiff {
  readonly diff: Diff;
  readonly cohort: ProposedCohort;
}

export const drawnFile: fc.Arbitrary<DrawnFile> = fc.record({
  hunks: fc.integer({ min: 1, max: 4 }),
  kind: fc.oneof(
    { weight: 3, arbitrary: fc.constant<FileKind>('source') },
    { weight: 1, arbitrary: fc.constantFrom<FileKind>(...KINDS) },
  ),
});

const pathOf = (at: number) => `src/file_${at}.ts`;

export const diffOf = (files: readonly DrawnFile[]): Diff => {
  let counted = 0;

  return Diff.of(
    files.map((file, at) => ({
      path: pathOf(at),
      previousPath: null,
      status: 'modified',
      binary: false,
      hunks: Array.from({ length: file.hunks }, () => {
        counted += 1;

        return {
          id: HunkId.at(counted),
          oldStart: counted,
          oldLines: 1,
          newStart: counted,
          newLines: 1,
          patch: `@@ -${counted} +${counted} @@\n-before\n+after ${counted}`,
        };
      }),
    })),
  );
};

export const factsOf = (
  diff: Diff,
  files: readonly DrawnFile[],
): DiffFacts => ({
  hunks: diff.files.flatMap((file, at) => {
    const kind = files[at]?.kind ?? 'source';

    return file.hunks.map((hunk): HunkFacts => ({
      hunk: hunk.id,
      path: file.path,
      fileClass: CLASSES[kind],
      incidental: kind !== 'source',
      renamed: kind === 'renamed',
      moved: false,
      linkable: kind === 'source',
      defines: [],
      outside: [],
    }));
  }),
  links: [],
  imports: [],
});

const dependenciesOf = (
  place: number,
): fc.Arbitrary<ProposedLayer['dependsOn']> =>
  place === 0
    ? fc.constant([])
    : fc
        .uniqueArray(fc.integer({ min: 1, max: place }), { maxLength: 3 })
        .chain((layers) =>
          fc.tuple(
            ...layers
              .sort((one, other) => one - other)
              .map((layer) =>
                fc
                  .subarray(SYMBOLS, { minLength: 1, maxLength: 2 })
                  .map((because) => ({ layer, because })),
              ),
          ),
        );

const questionOf = (
  place: number,
  shown: readonly HunkId[],
  every: readonly HunkId[],
): fc.Arbitrary<ProposedQuestion> =>
  fc
    .tuple(
      fc.oneof(
        { weight: 4, arbitrary: fc.constant(shown) },
        { weight: 1, arbitrary: fc.constant(every) },
      ),
      fc.string({ minLength: 1, maxLength: 6 }),
    )
    .chain(([from, word]) =>
      fc
        .subarray([...from], {
          minLength: 1,
          maxLength: Math.min(3, from.length),
        })
        .map((hunks) => ({
          question: `What does layer ${place + 1} show of ${word}?`,
          answer: `It shows ${hunks.join(', ')}.`,
          hunks,
        })),
    );

const layerOf = (
  diff: Diff,
  layers: readonly (readonly HunkId[])[],
  place: number,
): fc.Arbitrary<ProposedLayer> => {
  const hunks = layers[place] ?? [];
  const title = `Layer ${place + 1} of ${hunks.join(', ')}`;

  return fc
    .record({
      dependsOn: dependenciesOf(place),
      questions: fc.array(
        questionOf(place, layers.slice(0, place + 1).flat(), layers.flat()),
        { maxLength: 2 },
      ),
    })
    .map(({ dependsOn, questions }) => ({
      title,
      summary: `${title} changes things.`,
      dependsOn,
      hunks: hunks.map((hunk) => ({ hunk })),
      notes: [...diff.pathsOf(hunks)].map((path) => ({
        path,
        note: `${title} changes ${path}`,
      })),
      questions,
    }));
};

const cohortOf = (
  diff: Diff,
  layers: readonly (readonly HunkId[])[],
  title: string,
): fc.Arbitrary<ProposedCohort> =>
  fc
    .tuple(...layers.map((_, place) => layerOf(diff, layers, place)))
    .map((built) => ({
      kind: 'change',
      title,
      intent: `${title} does one thing.`,
      layers: built,
    }));

const groupedInto = (
  hunks: readonly HunkId[],
  keys: readonly number[],
  layersPer: number,
): HunkId[][][] => {
  const groups = new Map<number, Map<number, HunkId[]>>();

  hunks.forEach((hunk, at) => {
    const key = keys[at] ?? 0;
    const cohort = Math.floor(key / layersPer);
    const layer = key % layersPer;
    const layers = groups.get(cohort) ?? new Map<number, HunkId[]>();

    layers.set(layer, [...(layers.get(layer) ?? []), hunk]);
    groups.set(cohort, layers);
  });

  return [...groups.entries()]
    .sort(([one], [other]) => one - other)
    .map(([, layers]) =>
      [...layers.entries()]
        .sort(([one], [other]) => one - other)
        .map(([, placed]) => placed),
    );
};

const partitionOf = (
  hunks: readonly HunkId[],
  cohorts: number,
  layersPer: number,
): fc.Arbitrary<HunkId[][][]> =>
  fc
    .tuple(
      fc.shuffledSubarray([...hunks], {
        minLength: hunks.length,
        maxLength: hunks.length,
      }),
      fc.array(fc.integer({ min: 0, max: cohorts * layersPer - 1 }), {
        minLength: hunks.length,
        maxLength: hunks.length,
      }),
    )
    .map(([shuffled, keys]) => groupedInto(shuffled, keys, layersPer));

const drawnFiles = fc.array(drawnFile, { minLength: 1, maxLength: 6 });

export const cohortInDiff: fc.Arbitrary<CohortInDiff> = drawnFiles
  .map(diffOf)
  .chain((diff) =>
    partitionOf(
      diff.hunks.map((hunk) => hunk.id),
      1,
      5,
    ).chain((groups) =>
      cohortOf(diff, firstOf(groups) ?? [], 'A cohort').map((cohort) => ({
        diff,
        cohort,
      })),
    ),
  );

export const proposedStack: fc.Arbitrary<ProposedStack> = drawnFiles.chain(
  (files) => {
    const diff = diffOf(files);
    const facts = factsOf(diff, files);

    return fc
      .subarray(facts.hunks.filter((each) => each.incidental))
      .chain((proposedIncidental) =>
        partitionOf(
          facts.hunks
            .filter(
              (each) => !each.incidental || proposedIncidental.includes(each),
            )
            .map((each) => each.hunk),
          3,
          4,
        ),
      )
      .chain((partition) =>
        fc.tuple(
          ...partition.map((layers, at) =>
            cohortOf(diff, layers, `Cohort ${at + 1}`),
          ),
        ),
      )
      .map((cohorts) => ({ files, diff, facts, cohorts }));
  },
);

export const layersOf = (
  cohort: ProposedCohort,
): readonly (readonly HunkId[])[] =>
  cohort.layers.map((layer) => layer.hunks.map((entry) => entry.hunk));

export const placedHunks = (
  cohorts: readonly ProposedCohort[],
): readonly HunkId[] => cohorts.flatMap((cohort) => layersOf(cohort).flat());

export const hasEmptyLayer = (cohorts: readonly ProposedCohort[]): boolean =>
  cohorts.some((cohort) =>
    cohort.layers.some((layer) => layer.hunks.length === 0),
  );

export const dependsOnlyBackward = (cohort: ProposedCohort): boolean =>
  cohort.layers.every((layer, at) =>
    layer.dependsOn.every(
      (each) =>
        Number.isInteger(each.layer) && each.layer >= 1 && each.layer <= at,
    ),
  );

export const eachOnce = (
  placed: readonly string[],
  expected: readonly string[],
): boolean =>
  placed.length === expected.length &&
  new Set(placed).size === placed.length &&
  expected.every((each) => placed.includes(each));
