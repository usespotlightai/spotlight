import { InvalidCommitShaError } from '@work/domain/exceptions/invalid-commit-sha.error';
import { CommitSha } from '@work/domain/value-objects/commit-sha.vo';
import { describe, expect, it } from 'vitest';

describe('CommitSha', () => {
  it('takes SHA-1 and SHA-256 ids in any letter case, and compares them as git does', () => {
    expect(
      CommitSha.of('AB'.repeat(20)).equals(CommitSha.of('ab'.repeat(20))),
    ).toBe(true);
    expect(CommitSha.of('c'.repeat(64)).value).toBe('c'.repeat(64));
  });

  it('knows the id git uses for no commit', () => {
    expect(CommitSha.of('0'.repeat(40)).isNone).toBe(true);
    expect(CommitSha.of('1'.repeat(40)).isNone).toBe(false);
  });

  it('takes nothing that is not a commit id', () => {
    expect(() => CommitSha.of('main')).toThrow(InvalidCommitShaError);
    expect(() => CommitSha.of('a'.repeat(39))).toThrow(InvalidCommitShaError);
  });
});
