import { RunId } from '@domain/value-objects/run-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { HashedTraceParent } from '@infrastructure/tracing/hashed-trace-parent';
import { describe, expect, it } from 'vitest';

const naming = new HashedTraceParent();

const parts = (taskId: string, runId: string) =>
  naming.for(TaskId.of(taskId), RunId.of(runId)).split('-');

describe('HashedTraceParent', () => {
  it('names a run the way the format is read', () => {
    expect(naming.for(TaskId.of('task_1'), RunId.of('run_1'))).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
    );
  });

  it('says the same thing every time it is asked', () => {
    expect(naming.for(TaskId.of('task_1'), RunId.of('run_1'))).toBe(
      naming.for(TaskId.of('task_1'), RunId.of('run_1')),
    );
  });

  it('gives a task’s runs one trace and a span each', () => {
    const [, trace, span] = parts('task_1', 'run_1');
    const [, sameTrace, otherSpan] = parts('task_1', 'run_2');

    expect(trace).toBe(sameTrace);
    expect(span).not.toBe(otherSpan);
  });

  it('keeps one task’s trace out of another’s', () => {
    const [, trace] = parts('task_1', 'run_1');
    const [, other] = parts('task_2', 'run_1');

    expect(trace).not.toBe(other);
  });
});
