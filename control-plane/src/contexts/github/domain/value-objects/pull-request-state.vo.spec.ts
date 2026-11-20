import { pullRequestStatusOf } from '@github/domain/value-objects/pull-request-state.vo';
import { describe, expect, it } from 'vitest';

describe('pullRequestStatusOf', () => {
  it('calls an open draft a draft', () => {
    expect(pullRequestStatusOf('open', true)).toBe('draft');
  });

  it('keeps an open pull request that is ready for review open', () => {
    expect(pullRequestStatusOf('open', false)).toBe('open');
  });

  it('keeps a merged or closed draft merged or closed', () => {
    expect(pullRequestStatusOf('merged', true)).toBe('merged');
    expect(pullRequestStatusOf('closed', true)).toBe('closed');
  });
});
