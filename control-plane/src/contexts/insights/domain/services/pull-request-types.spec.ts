import { pullRequestTypeOf } from '@insights/domain/services/pull-request-types';
import { describe, expect, it } from 'vitest';

const typed = (
  title: string,
  over: {
    branch?: string | null;
    changeTitles?: readonly string[];
    changeIntents?: readonly string[];
  } = {},
) =>
  pullRequestTypeOf({
    title,
    branch: over.branch ?? null,
    changeTitles: over.changeTitles ?? [],
    changeIntents: over.changeIntents ?? [],
  });

describe('pullRequestTypeOf', () => {
  it('reads a conventional commit type off the title', () => {
    expect(typed('feat(api): accept uploads in parts')).toBe('feature');
    expect(typed('fix: stop dropping retries')).toBe('fix');
    expect(typed('refactor!: split the router')).toBe('refactor');
    expect(typed('perf: cache the lookup')).toBe('refactor');
    expect(typed('test: cover retries')).toBe('tests');
    expect(typed('chore(deps): bump vite')).toBe('chore');
    expect(typed('docs: explain retries')).toBe('chore');
  });

  it('reads the first word of a plain title', () => {
    expect(typed('Fix the flaky upload')).toBe('fix');
    expect(typed('Add retries to uploads')).toBe('feature');
    expect(typed('Extract the retry policy')).toBe('refactor');
    expect(typed('Add tests for the retry policy')).toBe('tests');
    expect(typed('Bump vite from 5 to 6')).toBe('chore');
    expect(typed('Revert "Add retries to uploads"')).toBe('chore');
    expect(typed('Update dependencies')).toBe('chore');
  });

  it('falls back to the branch name where the title says nothing', () => {
    expect(typed('Uploads', { branch: 'bugfix/uploads' })).toBe('fix');
    expect(typed('Uploads', { branch: 'dependabot/npm/vite' })).toBe('chore');
    expect(typed('Uploads', { branch: 'refactor-uploads' })).toBe('refactor');
  });

  it('calls a pull request it cannot read other', () => {
    expect(typed('Uploads', { branch: 'spotlight/task_1' })).toBe('other');
  });

  it('takes the change stack’s cohorts over the title where there are some', () => {
    expect(
      typed('Add retries to uploads', {
        changeTitles: ['Fix the retry loop', 'Fix the timeout', 'Add a flag'],
        changeIntents: ['', '', ''],
      }),
    ).toBe('fix');
  });

  it('reads a cohort’s intent where its title says nothing', () => {
    expect(
      typed('Uploads', {
        changeTitles: ['Uploads'],
        changeIntents: ['Refactor the upload queue into one module'],
      }),
    ).toBe('refactor');
  });

  it('breaks a tie between cohorts in the order the types are listed', () => {
    expect(typed('Uploads', { changeTitles: ['Refactor a', 'Add b'] })).toBe(
      'feature',
    );
  });

  it('reads no type from a word that only names a property of every object', () => {
    expect(
      pullRequestTypeOf({
        changeTitles: [],
        changeIntents: [],
        title: 'constructor: odd',
        branch: null,
      }),
    ).toBe('other');
  });
});
