import {
  latestShownPerRepository,
  newestFirst,
  type ShownStack,
} from '@change-review/domain/services/shown-stacks';
import { RepositoryName } from '@change-review/domain/value-objects/repository-name.vo';
import type { ChangeStackState } from '@change-review/domain/value-objects/stack-progress.vo';
import { describe, expect, it } from 'vitest';

interface Row {
  readonly id: string;
  readonly repository: string | null;
  readonly state: ChangeStackState;
  readonly startedAt: Date;
}

const START = new Date('2026-11-16T09:00:00.000Z');

const row = (
  id: string,
  repository: string | null,
  minutes: number,
  state: ChangeStackState = 'ready',
): Row => ({
  id,
  repository,
  state,
  startedAt: new Date(START.getTime() + minutes * 60_000),
});

const shownOf = (each: Row): ShownStack => ({
  id: each.id,
  startedAt: each.startedAt,
  repository: RepositoryName.optional(each.repository),
  state: each.state,
});

const latest = (rows: readonly Row[]) =>
  latestShownPerRepository(rows, shownOf).map((each) => each.id);

describe('newestFirst', () => {
  it('puts the stack started last first, and the greater id first when two started at once', () => {
    expect(
      newestFirst(
        [row('a', null, 1), row('c', null, 3), row('b', null, 1)],
        shownOf,
      ).map((each) => each.id),
    ).toEqual(['c', 'b', 'a']);
  });
});

describe('latestShownPerRepository', () => {
  it('keeps the newest stack of each repository, newest first', () => {
    expect(
      latest([
        row('web_new', 'web', 4),
        row('api_new', 'api', 3),
        row('web_old', 'web', 2),
        row('api_old', 'api', 1),
      ]),
    ).toEqual(['web_new', 'api_new']);
  });

  it('keeps the newest stack of each repository whatever order the stacks come in', () => {
    expect(
      latest([
        row('api_old', 'api', 1),
        row('web_old', 'web', 2),
        row('api_new', 'api', 3),
        row('web_new', 'web', 4),
      ]),
    ).toEqual(['web_new', 'api_new']);
  });

  it('takes repositories that differ only in case as one', () => {
    expect(latest([row('lower', 'web', 1), row('upper', 'Web', 2)])).toEqual([
      'upper',
    ]);
  });

  it('keeps stacks of no repository apart from those of a repository', () => {
    expect(
      latest([
        row('none_new', null, 3),
        row('web', 'web', 2),
        row('none_old', null, 1),
      ]),
    ).toEqual(['none_new', 'web']);
  });

  it('passes over a failed stack for the one before it', () => {
    expect(
      latest([
        row('failed', 'web', 2, 'failed'),
        row('generating', 'web', 1, 'generating'),
      ]),
    ).toEqual(['generating']);
  });
});
