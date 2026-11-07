import type {
  ChangeHunk,
  FileChange,
  JournalStep,
  RunJournal,
} from '@runs/application/contracts/run-journal.contract';
import { hunksOf } from '@runs/domain/services/change-hunks';
import { workingCopyPath } from '@runs/domain/services/working-copy-path';

const MAX_TEXT_PER_FILE = 256_000;

const MAX_TEXT_PER_RUN = 1_000_000;

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

  let left = MAX_TEXT_PER_RUN;

  return [...files.entries()]
    .filter(([, file]) => file.before !== file.after)
    .map(([path, file]) => {
      const size = file.before.length + file.after.length;

      if (size > MAX_TEXT_PER_FILE || size > left) {
        return { path, before: '', after: '', omitted: true };
      }

      left -= size;

      return { path, ...file, omitted: false };
    });
};

export const netHunksOf = (
  steps: readonly JournalStep[],
  checkouts: readonly string[],
): ChangeHunk[] => {
  const order: string[] = [];
  const first = new Map<string, string>();
  const last = new Map<string, string>();

  for (const step of steps) {
    const change = step.change;

    if (!change?.path) {
      continue;
    }

    if (!first.has(change.path)) {
      first.set(change.path, change.before);
      order.push(change.path);
    }

    last.set(change.path, change.after);
  }

  return order.flatMap((path) =>
    hunksOf(
      workingCopyPath(path, checkouts) ?? path,
      first.get(path) ?? '',
      last.get(path) ?? '',
    ),
  );
};
