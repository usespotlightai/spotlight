import { describe, expect, it } from 'vitest';
import {
  changesOf,
  type FileChange,
  fileName,
  linesOfHunk,
  repoRelative,
  tallyOf,
} from '@/lib/changes';
import type { JournalStep, RunJournal } from '@/lib/inbox';

const step = (part: Partial<JournalStep>): JournalStep =>
  ({
    kind: 'tool',
    text: 'edit',
    status: 'completed',
    tool: 'edit',
    detail: null,
    ms: 1,
    startedAt: '2026-08-29T12:00:00.000Z',
    locations: [],
    given: null,
    returned: null,
    change: null,
    ...part,
  }) as JournalStep;

const journal = (steps: JournalStep[]): RunJournal =>
  ({
    runId: 'r1',
    attempt: 1,
    steps,
    ms: null,
    spent: null,
    spans: [],
    marks: {
      startedAt: null,
      readyAt: null,
      spokeFrom: null,
      spokeTo: null,
      endedAt: null,
    },
  }) as RunJournal;

describe('changesOf', () => {
  it('keeps one entry per file, in the order first touched', () => {
    const files = changesOf([
      journal([
        step({ change: { path: 'a.ts', before: 'x', after: 'y' } }),
        step({ change: { path: 'b.ts', before: '1', after: '2' } }),
      ]),
    ]);

    expect(files.map((each) => each.path)).toEqual(['a.ts', 'b.ts']);
  });

  it('folds repeat edits to the first before and the last after', () => {
    const files = changesOf([
      journal([
        step({ change: { path: 'a.ts', before: 'one', after: 'two' } }),
        step({ change: { path: 'a.ts', before: 'two', after: 'three' } }),
      ]),
    ]);

    expect(files).toEqual([{ path: 'a.ts', before: 'one', after: 'three' }]);
  });

  it('drops a file left as it was found', () => {
    const files = changesOf([
      journal([
        step({ change: { path: 'a.ts', before: 'same', after: 'edited' } }),
        step({ change: { path: 'a.ts', before: 'edited', after: 'same' } }),
      ]),
    ]);

    expect(files).toEqual([]);
  });

  it('ignores steps that changed nothing or named no file', () => {
    const files = changesOf([
      journal([
        step({ change: null }),
        step({ change: { path: null, before: 'x', after: 'y' } }),
      ]),
    ]);

    expect(files).toEqual([]);
  });
});

describe('fileName', () => {
  it('keeps only the last segment', () => {
    expect(fileName('/workspace/example/README.md')).toBe('README.md');
  });

  it('leaves a bare name alone', () => {
    expect(fileName('Dockerfile')).toBe('Dockerfile');
  });
});

describe('repoRelative', () => {
  it('drops the runner workspace prefix', () => {
    expect(repoRelative('/workspace/example/README.md')).toBe(
      'example/README.md',
    );
  });

  it('leaves a path with no such prefix alone', () => {
    expect(repoRelative('src/app.ts')).toBe('src/app.ts');
  });
});

describe('tallyOf', () => {
  it('counts lines added and removed across files', () => {
    const files: FileChange[] = [
      { path: 'a.ts', before: 'a\nb\n', after: 'a\nB\nc\n' },
      { path: 'b.ts', before: 'keep\ngo\n', after: 'keep\n' },
    ];

    expect(tallyOf(files)).toEqual({ added: 2, removed: 2 });
  });

  it('is zero for no files', () => {
    expect(tallyOf([])).toEqual({ added: 0, removed: 0 });
  });
});

describe('linesOfHunk', () => {
  it('reads the lines a hunk covers in the changed file', () => {
    expect(linesOfHunk('@@ -12,4 +12,6 @@')).toEqual({ start: 12, end: 17 });
    expect(linesOfHunk('@@ -3 +3 @@')).toEqual({ start: 3, end: 3 });
    expect(linesOfHunk('@@ -0,0 +1,2 @@')).toEqual({ start: 1, end: 2 });
  });

  it('reads nothing from what is not a hunk header', () => {
    expect(linesOfHunk(null)).toBeNull();
    expect(linesOfHunk('not a hunk')).toBeNull();
  });
});
