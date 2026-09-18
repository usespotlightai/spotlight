import type { Diff } from '@change-review/domain/value-objects/diff.vo';
import { GitDiffReader } from '@change-review/infrastructure/change-stacks/git-diff.reader';
import { GitPatchWriter } from '@change-review/infrastructure/change-stacks/git-patch.writer';
import { describe, expect, it } from 'vitest';

const { diff: DIFF } = new GitDiffReader().read(
  [
    'diff --git a/src/queue.ts b/src/queue.ts',
    '--- a/src/queue.ts',
    '+++ b/src/queue.ts',
    '@@ -1,3 +1,3 @@',
    ' a',
    '-b',
    '+B',
    ' c',
    '@@ -20,3 +20,3 @@',
    ' t',
    '-u',
    '+U',
    ' v',
    'diff --git a/src/new.ts b/src/new.ts',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/src/new.ts',
    '@@ -0,0 +1 @@',
    '+export const created = true;',
    'diff --git a/old.md b/new.md',
    'similarity index 100%',
    'rename from old.md',
    'rename to new.md',
    'diff --git a/gone.ts b/gone.ts',
    'deleted file mode 100644',
    '--- a/gone.ts',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-export const gone = true;',
    'diff --git a/logo.png b/logo.png',
    'Binary files a/logo.png and b/logo.png differ',
  ].join('\n'),
);

const patchOf = (diff: Diff, hunks: ReadonlySet<string>) =>
  new GitPatchWriter().patchOf(diff, hunks);

describe('GitPatchWriter', () => {
  it('writes only the chosen hunks, with each file’s header', () => {
    expect(patchOf(DIFF, new Set(['h2', 'h3']))).toBe(
      [
        'diff --git a/src/queue.ts b/src/queue.ts',
        '--- a/src/queue.ts',
        '+++ b/src/queue.ts',
        '@@ -20,3 +20,3 @@',
        ' t',
        '-u',
        '+U',
        ' v',
        'diff --git a/src/new.ts b/src/new.ts',
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/src/new.ts',
        '@@ -0,0 +1 @@',
        '+export const created = true;',
        '',
      ].join('\n'),
    );
  });

  it('writes renames, deletions, and nothing for binary files', () => {
    expect(patchOf(DIFF, new Set(['h4', 'h5', 'h6']))).toBe(
      [
        'diff --git a/old.md b/new.md',
        'similarity index 100%',
        'rename from old.md',
        'rename to new.md',
        'diff --git a/gone.ts b/gone.ts',
        'deleted file mode 100644',
        '--- a/gone.ts',
        '+++ /dev/null',
        '@@ -1 +0,0 @@',
        '-export const gone = true;',
        '',
      ].join('\n'),
    );
  });
});
