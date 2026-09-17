import type {
  DiffReaderPort,
  DiffSource,
  ReadDiff,
} from '@change-review/application/ports/diff-reader.port';
import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import type { SourceSide } from '@change-review/domain/services/symbol-index';
import {
  Diff,
  type DiffFile,
  type DiffFileStatus,
  type DiffHunk,
  HUNK_HEADER,
  patchRowsOf,
} from '@change-review/domain/value-objects/diff.vo';

export const MOST_DIFF_LENGTH = 6 * 1024 * 1024;

export const CONTEXT_LINES = 3;

interface CutHunk {
  readonly oldStart: number;
  readonly oldLines: number;
  readonly newStart: number;
  readonly newLines: number;
  readonly patch: string;
}

interface OpenFile {
  path: string | null;
  oldPath: string | null;
  newPath: string | null;
  headerPaths: { old: string; new: string } | null;
  added: boolean;
  deleted: boolean;
  renamed: boolean;
  binary: boolean;
  hunks: { header: string; lines: string[] }[];
}

const unquoted = (raw: string): string => {
  const trimmed = raw.trim();

  return trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).replace(/\\(.)/g, '$1')
    : trimmed;
};

const sided = (raw: string): string | null => {
  const path = unquoted(raw.replace(/\t.*$/, ''));

  if (path === '/dev/null') {
    return null;
  }

  return path.replace(/^[ab]\//, '');
};

const headerPaths = (line: string): { old: string; new: string } | null => {
  const rest = line.slice('diff --git '.length);
  const split = rest.indexOf(' b/');

  return rest.startsWith('a/') && split > 0
    ? {
        old: unquoted(rest.slice(2, split)),
        new: unquoted(rest.slice(split + 3)),
      }
    : null;
};

const cut = (header: string, lines: readonly string[]): CutHunk[] => {
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

const sourcesOf = (
  file: OpenFile,
  before: string | null,
  after: string | null,
): DiffSource[] => {
  if (file.binary) {
    return [];
  }

  const sides: [SourceSide, string | null, Map<number, string>][] = [
    ['before', before, new Map()],
    ['after', after, new Map()],
  ];

  for (const hunk of file.hunks) {
    for (const row of patchRowsOf(hunk.header, hunk.lines)) {
      const text = row.lines[0]?.slice(1) ?? '';

      if (row.sign !== '+') {
        sides[0][2].set(row.old + 1, text);
      }
      if (row.sign !== '-') {
        sides[1][2].set(row.new + 1, text);
      }
    }
  }

  return sides.flatMap(([side, path, lines]) => {
    if (!path || lines.size === 0) {
      return [];
    }

    const length = Math.max(...lines.keys());

    return [
      {
        path,
        side,
        text: Array.from({ length }, (_, at) => lines.get(at + 1) ?? '').join(
          '\n',
        ),
      },
    ];
  });
};

const opened = (line: string): OpenFile => ({
  path: null,
  oldPath: null,
  newPath: null,
  headerPaths: headerPaths(line),
  added: false,
  deleted: false,
  renamed: false,
  binary: false,
  hunks: [],
});

const filesIn = (text: string): OpenFile[] => {
  const files: OpenFile[] = [];
  let current: OpenFile | null = null;

  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (line.startsWith('diff --git ')) {
      current = opened(line);
      files.push(current);
      continue;
    }

    if (!current) {
      continue;
    }

    const hunk = current.hunks[current.hunks.length - 1];

    if (hunk && /^[ +\-\\]/.test(line)) {
      hunk.lines.push(line);
      continue;
    }

    if (HUNK_HEADER.test(line)) {
      current.hunks.push({ header: line, lines: [] });
    } else if (line.startsWith('--- ')) {
      current.oldPath = sided(line.slice(4));
    } else if (line.startsWith('+++ ')) {
      current.newPath = sided(line.slice(4));
    } else if (line.startsWith('new file mode')) {
      current.added = true;
    } else if (line.startsWith('deleted file mode')) {
      current.deleted = true;
    } else if (line.startsWith('rename from ')) {
      current.renamed = true;
      current.oldPath = unquoted(line.slice('rename from '.length));
    } else if (line.startsWith('rename to ')) {
      current.renamed = true;
      current.newPath = unquoted(line.slice('rename to '.length));
    } else if (line.startsWith('Binary files ')) {
      current.binary = true;
    }
  }

  return files;
};

export class GitDiffReader implements DiffReaderPort {
  read(text: string): ReadDiff {
    if (text.length > MOST_DIFF_LENGTH) {
      throw new InvalidDiffError(
        `is at most ${MOST_DIFF_LENGTH / 1024 / 1024} MiB`,
      );
    }

    const files = filesIn(text);

    if (files.length === 0) {
      throw new InvalidDiffError(
        'holds no changes; hand it the output of git diff',
      );
    }

    let counted = 0;
    const sources: DiffSource[] = [];

    const parsed = files.map((file): DiffFile => {
      const oldPath = file.oldPath ?? file.headerPaths?.old ?? null;
      const newPath = file.newPath ?? file.headerPaths?.new ?? null;
      const path = file.deleted ? oldPath : (newPath ?? oldPath);

      if (!path) {
        throw new InvalidDiffError('names a file it does not say the path of');
      }

      const status: DiffFileStatus = file.added
        ? 'added'
        : file.deleted
          ? 'deleted'
          : file.renamed
            ? 'renamed'
            : 'modified';

      const cuts = file.hunks.flatMap((hunk) => cut(hunk.header, hunk.lines));
      const hunks = (
        cuts.length > 0
          ? cuts
          : [{ oldStart: 0, oldLines: 0, newStart: 0, newLines: 0, patch: '' }]
      ).map((hunk): DiffHunk => {
        counted += 1;

        return { id: `h${counted}`, ...hunk };
      });

      sources.push(
        ...sourcesOf(
          file,
          status === 'added' ? null : oldPath,
          status === 'deleted' ? null : path,
        ),
      );

      return {
        path,
        previousPath: status === 'renamed' ? oldPath : null,
        status,
        binary: file.binary,
        hunks,
      };
    });

    return { diff: Diff.of(parsed), sources };
  }
}
