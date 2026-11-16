import { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import { describe, expect, it } from 'vitest';

const SHA = '3f1c9a7e5b2d4c6f8a0e1b3d5c7f9a2e4b6d8c0f';

describe('SourceCommit', () => {
  it('knows the repository and commit a header names', () => {
    const commit = SourceCommit.named(`acme/config@${SHA}`);

    expect(commit?.repository.value).toBe('acme/config');
    expect(commit?.sha).toBe(SHA);
    expect(commit?.shortSha).toBe('3f1c9a7');
    expect(commit?.url).toBe(`https://github.com/acme/config/commit/${SHA}`);
    expect(commit?.toString()).toBe(`acme/config@${SHA}`);
  });

  it('keeps the commit in lower case', () => {
    expect(SourceCommit.named(` acme/config@${SHA.toUpperCase()} `)?.sha).toBe(
      SHA,
    );
  });

  it('knows a SHA-256 commit', () => {
    const sha = `${SHA}${SHA.slice(0, 24)}`;

    expect(SourceCommit.named(`acme/config@${sha}`)?.sha).toBe(sha);
  });

  it.each([
    [undefined],
    [''],
    [SHA],
    ['acme/config'],
    ['acme/config@main'],
    [`acme/config@${SHA.slice(0, 7)}`],
    [`acme@${SHA}`],
    [`acme/con fig@${SHA}`],
    [`acme/config/extra@${SHA}`],
  ])('is no commit when %o names none', (header) => {
    expect(SourceCommit.named(header)).toBeNull();
  });
});
