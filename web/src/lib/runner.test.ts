import { describe, expect, it } from 'vitest';
import { availableCount, isAvailable, type Runner } from '@/lib/runner';

const runner = (over: Partial<Runner>) =>
  ({
    id: 'r',
    pool: 'dev',
    connected: true,
    currentRun: null,
    ...over,
  }) as Runner;

describe('isAvailable', () => {
  it('counts a runner that is answering and holding nothing', () => {
    expect(isAvailable(runner({}))).toBe(true);
  });

  it('does not count one that is already on a run', () => {
    expect(isAvailable(runner({ currentRun: { id: 'run_1' } as never }))).toBe(
      false,
    );
  });

  it('does not count one that has stopped answering', () => {
    expect(isAvailable(runner({ connected: false }))).toBe(false);
  });
});

describe('availableCount', () => {
  it('counts only the runners that could take work now', () => {
    expect(
      availableCount([
        runner({ id: 'a' }),
        runner({ id: 'b', currentRun: { id: 'run_1' } as never }),
        runner({ id: 'c', connected: false }),
        runner({ id: 'd' }),
      ]),
    ).toBe(2);
  });

  it('is zero for an empty roster', () => {
    expect(availableCount([])).toBe(0);
  });
});
