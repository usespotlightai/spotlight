import { parseDiffFromFile } from '@pierre/diffs';
import type { RunJournal } from '@/lib/inbox';

export interface FileChange {
  readonly path: string;
  readonly before: string;
  readonly after: string;
}

export interface Tally {
  readonly added: number;
  readonly removed: number;
}

export const fileName = (path: string): string =>
  path.slice(path.lastIndexOf('/') + 1);

// The harness reports absolute paths inside the runner's workspace
// (`/workspaces/<key>/…`), where the repo sits at the workspace root.
export const repoRelative = (path: string): string =>
  path.replace(/^\/workspaces\/[^/]+\//, '');

// One entry per file, folding repeat edits to the first before and last after.
// Files left unchanged, and edits reported without a path, drop out.
export const changesOf = (journals: readonly RunJournal[]): FileChange[] => {
  const order: string[] = [];
  const first = new Map<string, string>();
  const last = new Map<string, string>();

  for (const journal of journals) {
    for (const step of journal.steps) {
      const change = step.change;

      if (!change || change.path === null) {
        continue;
      }

      if (!first.has(change.path)) {
        first.set(change.path, change.before);
        order.push(change.path);
      }
      last.set(change.path, change.after);
    }
  }

  return order.flatMap((path) => {
    const before = first.get(path) ?? '';
    const after = last.get(path) ?? '';

    return before === after ? [] : [{ path, before, after }];
  });
};

export const tallyFile = (file: FileChange): Tally => {
  const diff = parseDiffFromFile(
    { name: file.path, contents: file.before },
    { name: file.path, contents: file.after },
  );

  let added = 0;
  let removed = 0;

  for (const hunk of diff.hunks) {
    added += hunk.additionLines;
    removed += hunk.deletionLines;
  }

  return { added, removed };
};

export const tallyOf = (files: readonly FileChange[]): Tally =>
  files.reduce<Tally>(
    (all, file) => {
      const { added, removed } = tallyFile(file);
      return { added: all.added + added, removed: all.removed + removed };
    },
    { added: 0, removed: 0 },
  );
