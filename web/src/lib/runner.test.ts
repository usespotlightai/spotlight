import { describe, expect, it } from 'vitest';
import { isReachable, type Runner, reachableCount } from '@/lib/runner';

const runner = (over: Partial<Runner>) =>
  ({
    id: 'r',
    pool: 'dev',
    connected: true,
    currentRun: null,
    ...over,
  }) as Runner;

describe('isReachable', () => {
  it('counts a runner that is answering', () => {
    expect(isReachable(runner({}))).toBe(true);
  });

  it('still counts one that is busy on a run', () => {
    expect(isReachable(runner({ currentRun: { id: 'run_1' } as never }))).toBe(
      true,
    );
  });

  it('does not count one that has stopped answering', () => {
    expect(isReachable(runner({ connected: false }))).toBe(false);
  });
});

describe('reachableCount', () => {
  it('counts every runner the control plane can still hear from', () => {
    expect(
      reachableCount([
        runner({ id: 'a' }),
        runner({ id: 'b', currentRun: { id: 'run_1' } as never }),
        runner({ id: 'c', connected: false }),
      ]),
    ).toBe(2);
  });

  it('is zero for an empty roster', () => {
    expect(reachableCount([])).toBe(0);
  });
});
