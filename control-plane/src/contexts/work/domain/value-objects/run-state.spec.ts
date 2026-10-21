import {
  isStopping,
  progressOfCurrentRun,
} from '@work/domain/value-objects/run-state';
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

describe('progressOfCurrentRun', () => {
  it('counts a run that has no record yet as queued', () => {
    expect(progressOfCurrentRun(null)).toBe('queued');
  });

  it('counts a run that waits for a runner as queued', () => {
    expect(
      progressOfCurrentRun({ state: 'queued', stopRequested: false }),
    ).toBe('queued');
  });

  it('counts a run that a runner took as in progress', () => {
    expect(
      progressOfCurrentRun({ state: 'claimed', stopRequested: false }),
    ).toBe('in-progress');
  });

  it('counts no progress for a run that someone asked to stop', () => {
    expect(
      progressOfCurrentRun({ state: 'claimed', stopRequested: true }),
    ).toBeNull();
  });

  it('counts no progress for a run that waits for a person or has ended', () => {
    expect(
      progressOfCurrentRun({ state: 'waiting', stopRequested: false }),
    ).toBeNull();
    expect(
      progressOfCurrentRun({ state: 'completed', stopRequested: false }),
    ).toBeNull();
  });
});
