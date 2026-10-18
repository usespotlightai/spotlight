import type {
  DiffReaderPort,
  DiffSource,
  ReadDiff,
} from '@change-review/application/ports/diff-reader.port';
import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import type { SourceSide } from '@change-review/domain/services/symbol-index';
import {
  Diff,
  type DiffFileStatus,
  HUNK_HEADER,
  patchRowsOf,
  splitHunk,
  type UnnamedFile,
} from '@change-review/domain/value-objects/diff.vo';

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
    const files = filesIn(Diff.readable(text));

    if (files.length === 0) {
      throw new InvalidDiffError(
        'has no changes. Please pass the output of git diff',
      );
    }

    const sources: DiffSource[] = [];

    const parsed = files.map((file): UnnamedFile => {
      const oldPath = file.oldPath ?? file.headerPaths?.old ?? null;
      const newPath = file.newPath ?? file.headerPaths?.new ?? null;
      const path = file.deleted ? oldPath : (newPath ?? oldPath);

      if (!path) {
        throw new InvalidDiffError('has a file without a path');
      }

      const status: DiffFileStatus = file.added
        ? 'added'
        : file.deleted
          ? 'deleted'
          : file.renamed
            ? 'renamed'
            : 'modified';

      const cuts = file.hunks.flatMap((hunk) =>
        splitHunk(hunk.header, hunk.lines),
      );
      const hunks =
        cuts.length > 0
          ? cuts
          : [{ oldStart: 0, oldLines: 0, newStart: 0, newLines: 0, patch: '' }];

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

    return { diff: Diff.from(parsed), sources };
  }
}
