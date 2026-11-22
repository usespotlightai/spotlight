import { StackProblem } from '@change-review/domain/value-objects/stack-problem.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { describe, expect, it } from 'vitest';

describe('a problem of a drafted stack', () => {
  it('says what is wrong, trimmed, under its rule', () => {
    const problem = StackProblem.of('moves', ' h3 is code moved from h1 ');

    expect([problem.code, problem.message]).toEqual([
      'moves',
      'h3 is code moved from h1',
    ]);
    expect(StackProblem.shape('leaves h2 out').code).toBe('shape');
  });

  it('equals a problem of the same rule and words', () => {
    expect(
      StackProblem.shape('leaves h2 out').equals(
        StackProblem.shape('leaves h2 out'),
      ),
    ).toBe(true);
    expect(
      StackProblem.shape('leaves h2 out').equals(
        StackProblem.of('tests', 'leaves h2 out'),
      ),
    ).toBe(false);
  });

  it('never says nothing', () => {
    expect(() => StackProblem.shape(' ')).toThrow(InconsistentStateError);
  });
});
