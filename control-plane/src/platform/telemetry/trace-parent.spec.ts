import { traceParentOf } from '@platform/telemetry/trace-parent';
import { describe, expect, it } from 'vitest';

const parts = (trail: string, runId: string) =>
  traceParentOf(trail, runId).split('-');

describe('traceParentOf', () => {
  it('names a run the way the format is read', () => {
    expect(traceParentOf('task:task_1', 'run_1')).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
    );
  });

  it('says the same thing every time it is called', () => {
    expect(traceParentOf('task:task_1', 'run_1')).toBe(
      traceParentOf('task:task_1', 'run_1'),
    );
  });

  it('gives the runs of one trail one trace and a span each', () => {
    const [, trace, span] = parts('task:task_1', 'run_1');
    const [, sameTrace, otherSpan] = parts('task:task_1', 'run_2');

    expect(trace).toBe(sameTrace);
    expect(span).not.toBe(otherSpan);
  });

  it('keeps one trail’s trace out of another’s', () => {
    const [, trace] = parts('task:task_1', 'run_1');
    const [, other] = parts('search:task_1', 'run_1');

    expect(trace).not.toBe(other);
  });
});
