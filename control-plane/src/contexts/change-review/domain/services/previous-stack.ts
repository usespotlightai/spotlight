import {
  type DiffFacts,
  placedHunks,
} from '@change-review/domain/services/diff-facts';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type {
  Diff,
  DiffFile,
  DiffHunk,
} from '@change-review/domain/value-objects/diff.vo';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type {
  CohortKind,
  FileNote,
  LayerRevision,
  ProposedCohort,
  ProposedQuestion,
  RemovedLayer,
  StackCohort,
} from '@change-review/domain/value-objects/stack-cohort.vo';
import type {
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';
import type { ChangeStackState } from '@change-review/domain/value-objects/stack-progress.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export interface StackSnapshot {
  readonly id: ChangeStackId;
  readonly taskId: TaskId | null;
  readonly repository: RepositoryName | null;
  readonly state: ChangeStackState;
  readonly redrafting: boolean;
  readonly startedAt: Date;
  readonly diff: Diff;
  readonly facts: DiffFacts;
  readonly cohorts: readonly StackCohort[];
}

interface PreviousLayer {
  readonly id: LayerId;
  readonly title: string;
  readonly summary: string;
  readonly dependsOn: readonly {
    readonly layer: number;
    readonly because: readonly string[];
  }[];
  readonly hunks: readonly HunkId[];
  readonly paths: readonly string[];
  readonly fullyKept: boolean;
  readonly notes: readonly FileNote[];
  readonly questions: readonly ProposedQuestion[];
}

interface PreviousCohort {
  readonly kind: CohortKind;
  readonly title: string;
  readonly intent: string;
  readonly joinedBecause: string | null;
  readonly layers: readonly PreviousLayer[];
}

export interface PreviousStack {
  readonly stackId: ChangeStackId;
  readonly cohorts: readonly PreviousCohort[];
  readonly addedHunks: readonly HunkId[];
  readonly pathOfHunk: ReadonlyMap<HunkId, string>;
  readonly diffUnchanged: boolean;
}

const canBeFollowed = (stack: StackSnapshot): boolean =>
  stack.state === 'ready' && !stack.redrafting;

const followableBy = (
  previous: StackSnapshot,
  next: Pick<StackSnapshot, 'id' | 'taskId' | 'repository'>,
): boolean =>
  canBeFollowed(previous) &&
  !previous.id.equals(next.id) &&
  next.taskId !== null &&
  previous.taskId?.equals(next.taskId) === true &&
  RepositoryName.same(previous.repository, next.repository);

const chosenFrom = <S extends StackSnapshot>(
  candidates: readonly S[],
  next: Pick<StackSnapshot, 'id' | 'taskId' | 'repository'>,
): S | null =>
  candidates
    .filter((each) => followableBy(each, next))
    .reduce<S | null>(
      (latest, each) =>
        !latest ||
        each.startedAt > latest.startedAt ||
        (each.startedAt.getTime() === latest.startedAt.getTime() &&
          each.id.value > latest.id.value)
          ? each
          : latest,
      null,
    );

const changedLinesOf = (hunk: DiffHunk): string =>
  hunk.patch
    .split('\n')
    .slice(1)
    .filter((line) => line.startsWith('+') || line.startsWith('-'))
    .join('\n');

const keyOf = (file: DiffFile, hunk: DiffHunk): string =>
  `${file.path}\n${changedLinesOf(hunk)}`;

const matchedHunks = (
  previous: Diff,
  next: Diff,
): ReadonlyMap<HunkId, HunkId> => {
  const waiting = new Map<string, HunkId[]>();

  for (const file of next.files) {
    for (const hunk of file.hunks) {
      const key = keyOf(file, hunk);
      waiting.set(key, [...(waiting.get(key) ?? []), hunk.id]);
    }
  }

  const matched = new Map<HunkId, HunkId>();

  for (const file of previous.files) {
    for (const hunk of file.hunks) {
      const found = waiting.get(keyOf(file, hunk))?.shift();

      if (found) {
        matched.set(hunk.id, found);
      }
    }
  }

  return matched;
};

const of = (
  previous: StackSnapshot,
  next: Pick<StackSnapshot, 'diff' | 'facts'>,
): PreviousStack => {
  const { diff } = next;
  const matched = matchedHunks(previous.diff, diff);
  const kept = new Set(matched.values());
  const placedBefore = placedHunks(previous.facts);
  const placedNow = new Set(placedHunks(next.facts));

  const cohorts = previous.cohorts.map((cohort): PreviousCohort => {
    const positions = new Map(
      cohort.layers.map((layer, at) => [layer.id, at + 1]),
    );

    return {
      kind: cohort.kind,
      title: cohort.title,
      intent: cohort.intent,
      joinedBecause: cohort.joinedBecause,
      layers: cohort.layers.map((layer) => {
        const hunks = layer.hunks.flatMap(
          (entry) => matched.get(entry.hunk) ?? [],
        );

        return {
          id: layer.id,
          title: layer.title,
          summary: layer.summary,
          dependsOn: layer.dependsOn.flatMap((each) => {
            const at = positions.get(each.layer);
            return at ? [{ layer: at, because: [...each.because] }] : [];
          }),
          hunks,
          paths: [
            ...new Set(
              layer.hunks.flatMap(
                (entry) => previous.diff.fileOf(entry.hunk)?.path ?? [],
              ),
            ),
          ],
          fullyKept: hunks.length === layer.hunks.length,
          notes: layer.notes,
          questions: layer.questions.flatMap((each) => {
            const cited = each.hunks.map((hunk) => matched.get(hunk));

            return cited.every((hunk) => hunk !== undefined)
              ? [{ question: each.question, answer: each.answer, hunks: cited }]
              : [];
          }),
        };
      }),
    };
  });

  const addedHunks = diff.hunks
    .map((hunk) => hunk.id)
    .filter((hunk) => !kept.has(hunk));

  return {
    stackId: previous.id,
    cohorts,
    addedHunks,
    pathOfHunk: new Map(
      diff.files.flatMap((file) =>
        file.hunks.map((hunk) => [hunk.id, file.path] as const),
      ),
    ),
    diffUnchanged:
      placedBefore.every((hunk) => matched.has(hunk)) &&
      addedHunks.every((hunk) => !placedNow.has(hunk)),
  };
};

const reusedCohorts = (previous: PreviousStack): ProposedCohort[] =>
  previous.cohorts.map((cohort) => ({
    kind: cohort.kind,
    title: cohort.title,
    intent: cohort.intent,
    joinedBecause: cohort.joinedBecause,
    layers: cohort.layers.map((layer) => ({
      title: layer.title,
      summary: layer.summary,
      dependsOn: layer.dependsOn,
      hunks: layer.hunks.map((hunk) => ({ hunk })),
      notes: layer.notes,
      questions: layer.questions,
    })),
  }));

const sameHunks = (a: readonly HunkId[], b: readonly HunkId[]): boolean => {
  const set = new Set(a);
  return set.size === new Set(b).size && b.every((hunk) => set.has(hunk));
};

const mostShared = <K>(
  keys: readonly K[],
  ownersOf: (key: K) => readonly PreviousLayer[],
): PreviousLayer | null => {
  const shared = new Map<PreviousLayer, number>();

  for (const key of keys) {
    for (const owner of ownersOf(key)) {
      shared.set(owner, (shared.get(owner) ?? 0) + 1);
    }
  }

  let best: PreviousLayer | null = null;
  let most = 0;

  for (const [owner, count] of shared) {
    if (count > most) {
      best = owner;
      most = count;
    }
  }

  return best;
};

const revisionsOf = (
  previous: PreviousStack,
  cohorts: readonly ProposedCohort[],
): LayerRevision[][] => {
  const layers = previous.cohorts.flatMap((cohort) => cohort.layers);
  const byHunk = new Map(
    layers.flatMap((layer) =>
      layer.hunks.map((hunk) => [hunk, layer] as const),
    ),
  );
  const claimed = new Set(
    cohorts
      .flatMap((cohort) => cohort.layers)
      .flatMap((layer) => layer.hunks)
      .flatMap((entry) => byHunk.get(entry.hunk) ?? []),
  );
  const unclaimed = layers.filter((layer) => !claimed.has(layer));

  return cohorts.map((cohort) =>
    cohort.layers.map((layer): LayerRevision => {
      const hunks = layer.hunks.map((entry) => entry.hunk);
      const followed =
        mostShared(hunks, (hunk) => {
          const owner = byHunk.get(hunk);
          return owner ? [owner] : [];
        }) ??
        mostShared(
          [
            ...new Set(
              hunks.flatMap((hunk) => previous.pathOfHunk.get(hunk) ?? []),
            ),
          ],
          (path) => unclaimed.filter((each) => each.paths.includes(path)),
        );

      if (!followed) {
        return { status: 'added' };
      }

      return {
        status:
          followed.fullyKept && sameHunks(followed.hunks, hunks)
            ? 'unchanged'
            : 'modified',
        previous: followed.id,
      };
    }),
  );
};

const revised = (
  previous: PreviousStack,
  cohorts: readonly ProposedCohort[],
): {
  readonly cohorts: ProposedCohort[];
  readonly revisions: LayerRevision[][];
} => {
  const revisions = revisionsOf(previous, cohorts);
  const layers = new Map(
    previous.cohorts.flatMap((cohort) =>
      cohort.layers.map((layer) => [layer.id, layer] as const),
    ),
  );

  return {
    cohorts: cohorts.map((cohort, c) => ({
      ...cohort,
      layers: cohort.layers.map((layer, l) => {
        const revision = revisions[c]?.[l];
        const unchanged =
          revision?.status === 'unchanged'
            ? layers.get(revision.previous)
            : undefined;

        return unchanged ? { ...layer, questions: unchanged.questions } : layer;
      }),
    })),
    revisions,
  };
};

const removedFrom = (
  previous: PreviousStack,
  cohorts: readonly StackCohort[],
): RemovedLayer[] => {
  const placed = new Set(
    cohorts.flatMap((cohort) =>
      cohort.layers.flatMap((layer) => layer.hunks.map((entry) => entry.hunk)),
    ),
  );
  const followed = new Set(
    cohorts.flatMap((cohort) =>
      cohort.layers.flatMap((layer) =>
        layer.revision && layer.revision.status !== 'added'
          ? [layer.revision.previous]
          : [],
      ),
    ),
  );

  return previous.cohorts.flatMap((cohort) =>
    cohort.layers
      .filter(
        (layer) =>
          !followed.has(layer.id) &&
          !layer.hunks.some((hunk) => placed.has(hunk)),
      )
      .map((layer) => ({
        previous: layer.id,
        cohort: cohort.title,
        title: layer.title,
      })),
  );
};

export const PreviousStack = {
  chosenFrom,
  of,
  reusedCohorts,
  revised,
  removedFrom,
};
