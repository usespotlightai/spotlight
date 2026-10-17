import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import { HunkId } from '@change-review/domain/value-objects/stack-ids';

const MAX_HUNKS = 2_000;

const MAX_DIFF_LENGTH = 6 * 1024 * 1024;

const CONTEXT_LINES = 3;

export type DiffFileStatus = 'added' | 'deleted' | 'modified' | 'renamed';

export interface DiffHunk {
  readonly id: HunkId;
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

export interface UnnamedHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly patch: string;
}

export interface UnnamedFile {
  readonly path: string;
  readonly previousPath: string | null;
  readonly status: DiffFileStatus;
  readonly binary: boolean;
  readonly hunks: readonly UnnamedHunk[];
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

export const cutInto = (
  header: string,
  lines: readonly string[],
): UnnamedHunk[] => {
  const rows = patchRowsOf(header, lines);
  const changed = rows.flatMap((row, at) => (row.sign === ' ' ? [] : [at]));

  if (changed.length === 0) {
    return [];
  }

  const groups: [number, number][] = [];

  for (const at of changed) {
    const open = groups[groups.length - 1];

    if (open && at - open[1] - 1 <= 2 * CONTEXT_LINES) {
      open[1] = at;
    } else {
      groups.push([at, at]);
    }
  }

  const trailer = header.replace(HUNK_HEADER, '');

  return groups.map(([first, last], place) => {
    const from = Math.max(0, first - CONTEXT_LINES);
    const to = Math.min(rows.length - 1, last + CONTEXT_LINES);
    const slice = rows.slice(from, to + 1);
    const oldLines = slice.filter((row) => row.sign !== '+').length;
    const newLines = slice.filter((row) => row.sign !== '-').length;
    const start = slice[0] ?? rows[0];
    const oldStart = (start?.old ?? 0) + (oldLines > 0 ? 1 : 0);
    const newStart = (start?.new ?? 0) + (newLines > 0 ? 1 : 0);
    const whole = from === 0 && to === rows.length - 1;
    const written = whole
      ? header
      : `@@ -${oldStart},${oldLines} +${newStart},${newLines} @@${place === 0 ? trailer : ''}`;

    return {
      oldStart,
      oldLines,
      newStart,
      newLines,
      patch: [written, ...slice.flatMap((row) => row.lines)].join('\n'),
    };
  });
};

export class Diff {
  private constructor(readonly files: readonly DiffFile[]) {}

  static readable(text: string): string {
    if (text.length > MAX_DIFF_LENGTH) {
      throw new InvalidDiffError(
        `must be at most ${MAX_DIFF_LENGTH / 1024 / 1024} MiB`,
      );
    }

    return text;
  }

  static from(files: readonly UnnamedFile[]): Diff {
    let counted = 0;

    return Diff.of(
      files.map((file) => ({
        ...file,
        hunks: file.hunks.map((hunk) => {
          counted += 1;

          return { ...hunk, id: HunkId.at(counted) };
        }),
      })),
    );
  }

  static of(files: readonly DiffFile[]): Diff {
    if (files.length === 0) {
      throw new InvalidDiffError('has no changes');
    }

    const ids = new Set<string>();

    for (const file of files) {
      if (!file.path.trim()) {
        throw new InvalidDiffError('has a file without a path');
      }
      if (file.hunks.length === 0) {
        throw new InvalidDiffError(`has no changes for ${file.path}`);
      }
      for (const hunk of file.hunks) {
        if (ids.has(hunk.id)) {
          throw new InvalidDiffError(`lists ${hunk.id} twice`);
        }
        ids.add(hunk.id);
      }
    }

    if (ids.size > MAX_HUNKS) {
      throw new InvalidDiffError(`must have at most ${MAX_HUNKS} changes`);
    }

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
