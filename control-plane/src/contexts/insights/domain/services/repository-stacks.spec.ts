import {
  keepsOneStackEach,
  withLatestStack,
} from '@insights/domain/services/repository-stacks';
import { describe, expect, it } from 'vitest';

const EARLY = new Date('2026-11-21T09:00:00.000Z');
const LATE = new Date('2026-11-21T10:00:00.000Z');

const stack = (repository: string | null, stackStartedAt: Date, mark = '') => ({
  repository,
  stackStartedAt,
  mark,
});

const never = () => false;

describe('repository stacks', () => {
  it('keeps one stack for each repository, whatever the case of its name', () => {
    expect(keepsOneStackEach([stack('api', EARLY), stack(null, EARLY)])).toBe(
      true,
    );
    expect(keepsOneStackEach([stack('api', EARLY), stack('API', LATE)])).toBe(
      false,
    );
  });

  it('adds the stack of a repository it has no stack for', () => {
    const stacks = [stack('api', EARLY)];
    const web = stack('web', EARLY);

    expect(withLatestStack(stacks, web, never)).toEqual([...stacks, web]);
  });

  it('puts a later stack of the same repository in place of the earlier one', () => {
    const later = stack('API', LATE);

    expect(withLatestStack([stack('api', EARLY)], later, never)).toEqual([
      later,
    ]);
  });

  it('keeps the stacks it has for an earlier stack of the same repository', () => {
    const stacks = [stack('api', LATE)];

    expect(withLatestStack(stacks, stack('api', EARLY), () => true)).toBe(
      stacks,
    );
  });

  it('lets the caller break the tie between two of the same stack', () => {
    const stacks = [stack('api', EARLY, 'kept')];
    const next = stack('api', EARLY, 'next');

    expect(withLatestStack(stacks, next, never)).toBe(stacks);
    expect(withLatestStack(stacks, next, () => true)).toEqual([next]);
  });
});
