import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import { Diff } from '@change-review/domain/value-objects/diff.vo';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { describe, expect, it } from 'vitest';

const DIFF = [
  'diff --git a/src/invite.ts b/src/invite.ts',
  'new file mode 100644',
  'index 0000000..1111111',
  '--- /dev/null',
  '+++ b/src/invite.ts',
  '@@ -0,0 +1,2 @@',
  '+export class Invite {}',
  '+export const invite = () => new Invite();',
  'diff --git a/src/routes.ts b/src/routes.ts',
  'index 2222222..3333333 100644',
  '--- a/src/routes.ts',
  '+++ b/src/routes.ts',
  '@@ -1,3 +1,4 @@',
  ' import { users } from "./users";',
  '+import { invite } from "./invite";',
  ' ',
  ' export const routes = [users];',
  '@@ -20 +21 @@ export function mount() {',
  '-  mount(routes);',
  '+  mount([...routes, invite]);',
  '\\ No newline at end of file',
  'diff --git a/old.md b/new.md',
  'similarity index 100%',
  'rename from old.md',
  'rename to new.md',
  'diff --git a/logo.png b/logo.png',
  'deleted file mode 100644',
  'Binary files a/logo.png and /dev/null differ',
  '',
].join('\n');

const reader = new GitDiffReader();

describe('GitDiffReader', () => {
  const { diff } = reader.read(DIFF);

  it('reads each file with what happened to it', () => {
    expect(
      diff.files.map(({ path, previousPath, status, binary }) => ({
        path,
        previousPath,
        status,
        binary,
      })),
    ).toEqual([
      {
        path: 'src/invite.ts',
        previousPath: null,
        status: 'added',
        binary: false,
      },
      {
        path: 'src/routes.ts',
        previousPath: null,
        status: 'modified',
        binary: false,
      },
      {
        path: 'new.md',
        previousPath: 'old.md',
        status: 'renamed',
        binary: false,
      },
      { path: 'logo.png', previousPath: null, status: 'deleted', binary: true },
    ]);
  });

  it('numbers every hunk across the whole diff', () => {
    expect(diff.hunks.map((hunk) => hunk.id)).toEqual([
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
    ]);
  });

  it('keeps where each hunk sits and its lines', () => {
    const [, second, third] = diff.hunks;

    expect(second).toMatchObject({
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 4,
    });
    expect(second?.patch.split('\n')).toHaveLength(5);
    expect(third).toMatchObject({
      oldStart: 20,
      oldLines: 1,
      newStart: 21,
      newLines: 1,
    });
    expect(third?.patch).toContain('\\ No newline at end of file');
  });

  it('gives a file with no lines to show one empty hunk, so it is still placed', () => {
    expect(diff.files[2]?.hunks).toEqual([
      {
        id: 'h4',
        oldStart: 0,
        oldLines: 0,
        newStart: 0,
        newLines: 0,
        patch: '',
      },
    ]);
  });

  it('finds the file a hunk belongs to', () => {
    expect(diff.fileOf('h3')?.path).toBe('src/routes.ts');
    expect(diff.fileOf('h99')).toBeNull();
  });

  it('refuses text that holds no changes', () => {
    expect(() => reader.read('nothing to see')).toThrow(InvalidDiffError);
  });

  it('refuses a diff too long to draft', () => {
    expect(() => reader.read('x'.repeat(7 * 1024 * 1024))).toThrow(
      InvalidDiffError,
    );
  });
});

describe('GitDiffReader with the whole file as context', () => {
  const unchanged = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, at) => ` line ${from + at}`);

  const WHOLE = [
    'diff --git a/src/queue.ts b/src/queue.ts',
    '--- a/src/queue.ts',
    '+++ b/src/queue.ts',
    '@@ -1,30 +1,30 @@',
    ...unchanged(1, 4),
    '-line 5',
    '+line five',
    ...unchanged(6, 24),
    '-line 25',
    '+line twenty-five',
    ...unchanged(26, 30),
  ].join('\n');

  const { diff, sources } = reader.read(WHOLE);

  it('cuts it into hunks with the usual few lines around each change', () => {
    expect(diff.hunks).toEqual([
      {
        id: 'h1',
        oldStart: 2,
        oldLines: 7,
        newStart: 2,
        newLines: 7,
        patch: [
          '@@ -2,7 +2,7 @@',
          ...unchanged(2, 4),
          '-line 5',
          '+line five',
          ...unchanged(6, 8),
        ].join('\n'),
      },
      {
        id: 'h2',
        oldStart: 22,
        oldLines: 7,
        newStart: 22,
        newLines: 7,
        patch: [
          '@@ -22,7 +22,7 @@',
          ...unchanged(22, 24),
          '-line 25',
          '+line twenty-five',
          ...unchanged(26, 28),
        ].join('\n'),
      },
    ]);
  });

  it('keeps changes close together in one hunk', () => {
    const { diff: close } = reader.read(
      [
        'diff --git a/a.ts b/a.ts',
        '--- a/a.ts',
        '+++ b/a.ts',
        '@@ -1,9 +1,9 @@',
        '-line 1',
        '+line one',
        ...unchanged(2, 7),
        '-line 8',
        '+line eight',
        ' line 9',
      ].join('\n'),
    );

    expect(close.hunks).toHaveLength(1);
  });

  it('keeps each side of the file, lines in place', () => {
    const lines = (side: 'before' | 'after') =>
      sources.find((each) => each.side === side)?.text.split('\n');

    expect(sources.map((each) => [each.path, each.side])).toEqual([
      ['src/queue.ts', 'before'],
      ['src/queue.ts', 'after'],
    ]);
    expect(lines('before')?.[4]).toBe('line 5');
    expect(lines('after')?.[4]).toBe('line five');
    expect(lines('after')).toHaveLength(30);
  });

  it('leaves gaps blank where the diff shows too little of a file', () => {
    const short = reader.read(
      [
        'diff --git a/a.ts b/a.ts',
        '--- a/a.ts',
        '+++ b/a.ts',
        '@@ -10 +10 @@',
        '-old',
        '+new',
      ].join('\n'),
    );

    expect(short.sources[1]?.text.split('\n')).toEqual([
      ...Array(9).fill(''),
      'new',
    ]);
  });

  it('reads a diff that equals the one kept', () => {
    expect(Diff.rehydrate(diff.files).equals(diff)).toBe(true);
    expect(reader.read(WHOLE).diff.equals(diff)).toBe(true);
  });
});
