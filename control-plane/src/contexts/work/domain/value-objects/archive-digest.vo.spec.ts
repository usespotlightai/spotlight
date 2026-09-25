import { InvalidWorkspaceArchiveError } from '@work/domain/exceptions/invalid-workspace-archive.error';
import { ArchiveDigest } from '@work/domain/value-objects/archive-digest.vo';
import { describe, expect, it } from 'vitest';

describe('ArchiveDigest', () => {
  it('holds a SHA-256 as lowercase hexadecimal', () => {
    expect(ArchiveDigest.of('AB'.repeat(32)).sha256).toBe('ab'.repeat(32));
  });

  it.each(['', 'ab', 'g'.repeat(64), 'a'.repeat(65)])('refuses %o', (raw) => {
    expect(() => ArchiveDigest.of(raw)).toThrow(InvalidWorkspaceArchiveError);
  });
});
