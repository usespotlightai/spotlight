import {
  isStopping,
  workOfCurrentRun,
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

describe('workOfCurrentRun', () => {
  it('counts a run that has no record yet as queued', () => {
    expect(workOfCurrentRun(null)).toBe('queued');
  });

  it('counts a run that waits for a runner as queued', () => {
    expect(workOfCurrentRun({ state: 'queued', stopRequested: false })).toBe(
      'queued',
    );
  });

  it('counts a run that a runner took as in progress', () => {
    expect(workOfCurrentRun({ state: 'claimed', stopRequested: false })).toBe(
      'in-progress',
    );
  });

  it('counts no work for a run that someone asked to stop', () => {
    expect(
      workOfCurrentRun({ state: 'claimed', stopRequested: true }),
    ).toBeNull();
  });

  it('counts no work for a run that waits for a person or has ended', () => {
    expect(
      workOfCurrentRun({ state: 'waiting', stopRequested: false }),
    ).toBeNull();
    expect(
      workOfCurrentRun({ state: 'completed', stopRequested: false }),
    ).toBeNull();
  });
});
