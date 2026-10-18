import {
  ChangeChecks,
  type StackStatus,
} from '@replays/domain/value-objects/change-checks.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { describe, expect, it } from 'vitest';

const stack = (
  repository: string,
  state: StackStatus['state'],
  more: Partial<StackStatus> = {},
): StackStatus => ({
  repository,
  state,
  skip: null,
  failedAt: [],
  spent: ModelSpent.of([], 0),
  ...more,
});

describe('ChangeChecks', () => {
  it('waits on a stack still generating before one still checking', () => {
    expect(
      ChangeChecks.of([stack('api', 'checking'), stack('web', 'generating')])
        .state,
    ).toBe('generating');
    expect(
      ChangeChecks.of([stack('api', 'passed'), stack('web', 'checking')]).state,
    ).toBe('checking');
  });

  it('fails on any failed stack, naming each failure by its repository', () => {
    const checks = ChangeChecks.of([
      stack('api', 'passed'),
      stack('web', 'failed', { failedAt: ['the whole change'] }),
      stack('docs', 'skipped', { skip: 'setup-failed' }),
    ]);

    expect(checks.state).toBe('failed');
    expect(checks.failedAt).toEqual(['web: the whole change']);
  });

  it('is unchecked when a stack went unchecked or was not generated, saying why', () => {
    expect(
      ChangeChecks.of([
        stack('api', 'passed'),
        stack('web', 'skipped', { skip: 'queue-timeout' }),
      ]),
    ).toMatchObject({ state: 'unchecked', why: 'queue-timeout' });
    expect(ChangeChecks.of([stack('api', 'not-generated')])).toMatchObject({
      state: 'unchecked',
      why: 'not-generated',
    });
  });

  it('passes when every checked stack passed, has none to check without a check, and is absent without a stack', () => {
    expect(
      ChangeChecks.of([stack('api', 'passed'), stack('web', 'unchecked')])
        .state,
    ).toBe('passed');
    expect(ChangeChecks.of([stack('api', 'unchecked')]).state).toBe('none');
    expect(ChangeChecks.of([]).state).toBe('absent');
  });
});
