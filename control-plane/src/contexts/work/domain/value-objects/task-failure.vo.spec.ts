import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidTaskFailureError } from '@work/domain/exceptions/invalid-task-failure.error';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { describe, expect, it } from 'vitest';

describe('TaskFailure', () => {
  it('comes from a run or from a named hook', () => {
    expect(TaskFailure.fromRun('exited').source).toBe('run');
    expect(TaskFailure.fromHook(' notify ', 'loop').source).toBe('hook:notify');
    expect(
      TaskFailure.fromHook('notify', 'loop').sameAs(
        TaskFailure.fromHook('notify', 'loop'),
      ),
    ).toBe(true);
    expect(
      TaskFailure.fromHook('notify', 'loop').sameAs(
        TaskFailure.fromRun('loop'),
      ),
    ).toBe(false);
  });

  it('refuses a failure that says nothing of what went wrong, or of which hook', () => {
    expect(() => TaskFailure.fromRun(' ')).toThrow(InvalidTaskFailureError);
    expect(() => TaskFailure.fromHook(' ', 'loop')).toThrow(
      InvalidTaskFailureError,
    );
  });

  it('refuses to read back a failure from nowhere a failure comes from', () => {
    expect(() =>
      TaskFailure.rehydrate({ source: 'cron', code: 'loop', occurrences: 1 }),
    ).toThrow(InconsistentStateError);
    expect(
      TaskFailure.rehydrate({
        source: 'hook:notify',
        code: 'loop',
        occurrences: 2,
      }).occurrences,
    ).toBe(2);
  });
});
