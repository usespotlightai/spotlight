import { InvalidWorkspaceSlugError } from '@domain/exceptions/invalid-workspace-slug.error';
import { WorkspaceSlug } from '@domain/value-objects/workspace-slug.vo';
import { describe, expect, it } from 'vitest';

describe('WorkspaceSlug', () => {
  it('accepts letters, numbers and single inner dashes', () => {
    expect(WorkspaceSlug.of('acme-cafe-inc').value).toBe('acme-cafe-inc');
    expect(WorkspaceSlug.of('acme2').value).toBe('acme2');
  });

  it('lowercases and trims what it is handed', () => {
    expect(WorkspaceSlug.of('  Acme  ').value).toBe('acme');
  });

  it.each([
    ['blank', '   '],
    ['a leading dash', '-acme'],
    ['a trailing dash', 'acme-'],
    ['doubled dashes', 'acme--inc'],
    ['spaces', 'acme inc'],
    ['punctuation', 'acme!'],
    ['non-ascii', 'café'],
    ['over 48 characters', 'a'.repeat(49)],
  ])('rejects %s', (_reason, candidate) => {
    expect(() => WorkspaceSlug.of(candidate)).toThrow(
      InvalidWorkspaceSlugError,
    );
  });

  it('compares by value', () => {
    expect(WorkspaceSlug.of('acme').equals(WorkspaceSlug.of('acme'))).toBe(
      true,
    );
  });
});
