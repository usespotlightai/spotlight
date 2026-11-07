import type {
  DiffFacts,
  FileImport,
  HunkFacts,
  HunkLink,
} from '@change-review/domain/services/diff-facts';
import { groupedBy } from '@change-review/domain/services/grouped-by';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import type { HunkId } from '@change-review/domain/value-objects/stack-ids';

export interface StackPart {
  readonly diff: Diff;
  readonly facts: DiffFacts;
}

export type StackParts = (hunks: readonly HunkId[]) => StackPart;

const indexed = <T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, { item: T; at: number }[]> =>
  groupedBy(
    items.map((item, at) => ({ item, at })),
    ({ item }) => keyOf(item),
  );

const inOrder = <T>(entries: readonly { item: T; at: number }[]): T[] =>
  [...entries].sort((a, b) => a.at - b.at).map(({ item }) => item);

export const stackPartsOf = (diff: Diff, facts: DiffFacts): StackParts => {
  const files = indexed(diff.files, (file) => file);
  const hunkFacts = indexed<HunkFacts, string>(
    facts.hunks,
    (each) => each.hunk,
  );
  const linksFrom = indexed<HunkLink, string>(facts.links, (link) => link.from);
  const importsFrom = indexed<FileImport, string>(
    facts.imports,
    (each) => each.from,
  );

  return (hunks) => {
    const within = new Set<HunkId>(hunks);
    const touched = new Map<DiffFile, number>();

    for (const hunk of within) {
      const file = diff.fileOf(hunk);
      const at = file ? files.get(file)?.[0]?.at : undefined;

      if (file && at !== undefined) {
        touched.set(file, at);
      }
    }

    const partFiles = [...touched]
      .sort(([, a], [, b]) => a - b)
      .map(([file]) => ({
        ...file,
        hunks: file.hunks.filter((hunk) => within.has(hunk.id)),
      }));
    const paths = new Set(partFiles.map((file) => file.path));

    return {
      diff: Diff.of(partFiles),
      facts: {
        hunks: inOrder(
          [...within].flatMap((hunk) => hunkFacts.get(hunk) ?? []),
        ),
        links: inOrder(
          [...within].flatMap((hunk) =>
            (linksFrom.get(hunk) ?? []).filter(({ item }) =>
              within.has(item.to),
            ),
          ),
        ),
        imports: inOrder(
          [...paths].flatMap((path) =>
            (importsFrom.get(path) ?? []).filter(({ item }) =>
              paths.has(item.to),
            ),
          ),
        ),
      },
    };
  };
};

export const stackPartOf = (
  diff: Diff,
  facts: DiffFacts,
  hunks: readonly HunkId[],
): StackPart => stackPartsOf(diff, facts)(hunks);
