import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import { ArchiveSize } from '@work/domain/value-objects/archive-size.vo';
import { describe, expect, it } from 'vitest';

describe('ArchiveSize', () => {
  it('takes a whole number of bytes, up to 2 GiB', () => {
    expect(ArchiveSize.of(1).bytes).toBe(1);
    expect(ArchiveSize.of(2 * 1024 ** 3).bytes).toBe(2 * 1024 ** 3);
  });

  it.each([0, -1, 1.5, Number.NaN, 2 * 1024 ** 3 + 1])(
    'rejects %s',
    (bytes) => {
      expect(() => ArchiveSize.of(bytes)).toThrow(InvalidWorkspaceArchiveError);
    },
  );
});
