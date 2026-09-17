import { InvalidDiffError } from '@change-review/domain/exceptions/invalid-diff.error';
import {
  Diff,
  type DiffFile,
} from '@change-review/domain/value-objects/diff.vo';
import { describe, expect, it } from 'vitest';

const file = (path: string, ...ids: string[]): DiffFile => ({
  path,
  previousPath: null,
  status: 'modified',
  binary: false,
  hunks: ids.map((id) => ({
    id,
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    patch: '@@ -1 +1 @@\n-before\n+after',
  })),
});

describe('Diff', () => {
  it('finds the file a hunk belongs to', () => {
    const diff = Diff.of([file('a.ts', 'h1'), file('b.ts', 'h2', 'h3')]);

    expect(diff.hunks.map((hunk) => hunk.id)).toEqual(['h1', 'h2', 'h3']);
    expect(diff.fileOf('h3')?.path).toBe('b.ts');
    expect(diff.fileOf('h99')).toBeNull();
  });

  it('refuses no files, a file with nothing to place, and a hunk named twice', () => {
    expect(() => Diff.of([])).toThrow(InvalidDiffError);
    expect(() => Diff.of([file('a.ts')])).toThrow(InvalidDiffError);
    expect(() => Diff.of([file('a.ts', 'h1'), file('b.ts', 'h1')])).toThrow(
      InvalidDiffError,
    );
  });

  it('equals a diff of the same files and hunks', () => {
    const diff = Diff.of([file('a.ts', 'h1')]);

    expect(diff.equals(Diff.rehydrate([file('a.ts', 'h1')]))).toBe(true);
    expect(diff.equals(Diff.of([file('b.ts', 'h1')]))).toBe(false);
  });
});
