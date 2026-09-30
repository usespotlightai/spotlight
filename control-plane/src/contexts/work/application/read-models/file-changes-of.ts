import type { RunJournal } from '@work/application/contracts/run-journal.contract';

export interface FileChange {
  readonly path: string;
  readonly before: string;
  readonly after: string;
  readonly omitted: boolean;
}

const MOST_TEXT_PER_FILE = 256_000;

const MOST_TEXT_PER_RUN = 1_000_000;

export const fileChangesOf = (journal: RunJournal): FileChange[] => {
  const files = new Map<string, { before: string; after: string }>();

  for (const step of journal.steps) {
    const change = step.change;

    if (!change?.path) {
      continue;
    }

    const seen = files.get(change.path);

    files.set(change.path, {
      before: seen ? seen.before : change.before,
      after: change.after,
    });
  }

  let left = MOST_TEXT_PER_RUN;

  return [...files.entries()]
    .filter(([, file]) => file.before !== file.after)
    .map(([path, file]) => {
      const size = file.before.length + file.after.length;

      if (size > MOST_TEXT_PER_FILE || size > left) {
        return { path, before: '', after: '', omitted: true };
      }

      left -= size;

      return { path, ...file, omitted: false };
    });
};
