import { traceParentFor } from '@application/contracts/trace-parent';
import { describe, expect, it } from 'vitest';

describe('traceParentFor', () => {
  it('names a run the way the format is read', () => {
    expect(traceParentFor('task_1', 'run_1')).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/,
    );
  });

  // A run that is tried again must name itself the same way, or its second
  // attempt lands somewhere its first cannot be found.
  it('says the same thing twice', () => {
    expect(traceParentFor('task_1', 'run_1')).toBe(
      traceParentFor('task_1', 'run_1'),
    );
  });

  // Every run that worked one task belongs in one trace; each still needs to
  // be told apart inside it.
  it('gives a task’s runs one trace and a span each', () => {
    const [, trace, span] = traceParentFor('task_1', 'run_1').split('-');
    const [, sameTrace, otherSpan] = traceParentFor('task_1', 'run_2').split(
      '-',
    );

    expect(trace).toBe(sameTrace);
    expect(span).not.toBe(otherSpan);
  });

  it('keeps one task’s trace out of another’s', () => {
    const [, trace] = traceParentFor('task_1', 'run_1').split('-');
    const [, other] = traceParentFor('task_2', 'run_1').split('-');

    expect(trace).not.toBe(other);
  });
});
