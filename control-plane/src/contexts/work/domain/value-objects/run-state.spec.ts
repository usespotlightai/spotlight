import { isQueued, isStopping } from '@work/domain/value-objects/run-state';
import { describe, expect, it } from 'vitest';

describe('isStopping', () => {
  it('stops a run that was asked to stop and still runs', () => {
    expect(isStopping('claimed', true)).toBe(true);
    expect(isStopping('waiting', true)).toBe(true);
  });

  it('does not stop a run nobody asked to stop', () => {
    expect(isStopping('claimed', false)).toBe(false);
  });

  it('does not stop a run that has ended', () => {
    expect(isStopping('cancelled', true)).toBe(false);
    expect(isStopping('failed', true)).toBe(false);
  });
});

describe('isQueued', () => {
  it('queues a run that waits for a runner', () => {
    expect(isQueued('queued', false)).toBe(true);
  });

  it('does not queue a run that was asked to stop', () => {
    expect(isQueued('queued', true)).toBe(false);
  });

  it('does not queue a run that a runner took', () => {
    expect(isQueued('claimed', false)).toBe(false);
  });
});
