import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';

export const MOST_HUNKS = 2_000;

export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed';

export interface DiffHunk {
  readonly id: string;
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly patch: string;
}

export interface DiffFile {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: DiffFileStatus;
  readonly binary: boolean;
  readonly hunks: readonly DiffHunk[];
}

export interface PatchRow {
  readonly sign: ' ' | '+' | '-';
  readonly lines: readonly string[];
  readonly old: number;
  readonly new: number;
}

export const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

export const patchRowsOf = (
  header: string,
  lines: readonly string[],
): PatchRow[] => {
  const [, oldStart, oldCount, newStart, newCount] =
    HUNK_HEADER.exec(header) ?? [];
  let old = Number(oldStart ?? 0) - (Number(oldCount ?? 1) > 0 ? 1 : 0);
  let added = Number(newStart ?? 0) - (Number(newCount ?? 1) > 0 ? 1 : 0);
  const rows: {
    sign: PatchRow['sign'];
    lines: string[];
    old: number;
    new: number;
  }[] = [];

  for (const line of lines) {
    const last = rows[rows.length - 1];

    if (line.startsWith('\\')) {
      last?.lines.push(line);
      continue;
    }

    const sign = line[0] === '+' || line[0] === '-' ? line[0] : ' ';

    rows.push({ sign, lines: [line], old, new: added });

    if (sign !== '+') {
      old += 1;
    }
    if (sign !== '-') {
      added += 1;
    }
  }

  return rows;
};

export const tallyOf = (
  files: readonly DiffFile[],
): { added: number; removed: number } => {
  let added = 0;
  let removed = 0;

  for (const file of files) {
    for (const hunk of file.hunks) {
      const [header = '', ...lines] = hunk.patch.split('\n');

      for (const row of header ? patchRowsOf(header, lines) : []) {
        if (row.sign === '+') {
          added += 1;
        } else if (row.sign === '-') {
          removed += 1;
        }
      }
    }
  }

  return { added, removed };
};

export const changedLinesOf = (
  hunk: DiffHunk,
): { added: number[]; removed: number[] } => {
  const [header = '', ...lines] = hunk.patch.split('\n');
  const rows = header ? patchRowsOf(header, lines) : [];

  return {
    added: rows.flatMap((row) => (row.sign === '+' ? [row.new + 1] : [])),
    removed: rows.flatMap((row) => (row.sign === '-' ? [row.old + 1] : [])),
  };
};

const sameHunk = (a: DiffHunk, b: DiffHunk): boolean =>
  a.id === b.id &&
  a.oldStart === b.oldStart &&
  a.oldLines === b.oldLines &&
  a.newStart === b.newStart &&
  a.newLines === b.newLines &&
  a.patch === b.patch;

const sameFile = (a: DiffFile, b: DiffFile): boolean =>
  a.path === b.path &&
  a.previousPath === b.previousPath &&
  a.status === b.status &&
  a.binary === b.binary &&
  a.hunks.length === b.hunks.length &&
  a.hunks.every((hunk, at) => {
    const other = b.hunks[at];
    return other !== undefined && sameHunk(hunk, other);
  });

export class Diff {
  private constructor(readonly files: readonly DiffFile[]) {}

  static of(files: readonly DiffFile[]): Diff {
    if (files.length === 0) {
      throw new InvalidDiffError('holds no changes');
    }

    const ids = new Set<string>();

    for (const file of files) {
      if (!file.path.trim()) {
        throw new InvalidDiffError('names a file it does not say the path of');
      }
      if (file.hunks.length === 0) {
        throw new InvalidDiffError(`gives ${file.path} nothing to place`);
      }
      for (const hunk of file.hunks) {
        if (ids.has(hunk.id)) {
          throw new InvalidDiffError(`names ${hunk.id} twice`);
        }
        ids.add(hunk.id);
      }
    }

    if (ids.size > MOST_HUNKS) {
      throw new InvalidDiffError(`holds at most ${MOST_HUNKS} changes`);
    }

    return new Diff(files);
  }

  static rehydrate(files: readonly DiffFile[]): Diff {
    return new Diff(files);
  }

  get hunks(): readonly DiffHunk[] {
    return this.files.flatMap((file) => file.hunks);
  }

  fileOf(hunkId: string): DiffFile | null {
    return (
      this.files.find((file) =>
        file.hunks.some((hunk) => hunk.id === hunkId),
      ) ?? null
    );
  }

  equals(other: Diff): boolean {
    return (
      this.files.length === other.files.length &&
      this.files.every((file, at) => {
        const theirs = other.files[at];
        return theirs !== undefined && sameFile(file, theirs);
      })
    );
  }
}
