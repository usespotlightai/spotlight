import {
  isStopping,
  progressOfCurrentRun,
  resumable,
  takenUpOnAnswer,
} from '@work/domain/value-objects/run-state';
import { describe, expect, it } from 'vitest';

describe('isStopping', () => {
  it('stops a run that was asked to stop and still runs', () => {
    expect(isStopping('claimed', true)).toBe(true);
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
    expect(progressOfCurrentRun(null, false)).toBe('queued');
  });

  it('counts a run that waits for a runner as queued', () => {
    expect(
      progressOfCurrentRun({ state: 'queued', stopRequested: false }, false),
    ).toBe('queued');
  });

  it('counts a run that a runner took as in progress', () => {
    expect(
      progressOfCurrentRun({ state: 'claimed', stopRequested: false }, false),
    ).toBe('in-progress');
  });

  it('counts a run that someone asked to stop as stopping', () => {
    expect(
      progressOfCurrentRun({ state: 'claimed', stopRequested: true }, false),
    ).toBe('stopping');
  });

  it('counts a suspended run that a person answered as queued, as the answer takes it up', () => {
    expect(
      progressOfCurrentRun({ state: 'suspended', stopRequested: false }, true),
    ).toBe('queued');
  });

  it('counts no progress for a run that waits for a person or has ended', () => {
    expect(
      progressOfCurrentRun({ state: 'suspended', stopRequested: false }, false),
    ).toBeNull();
    expect(
      progressOfCurrentRun({ state: 'completed', stopRequested: false }, false),
    ).toBeNull();
  });
});

describe('resumable', () => {
  it('takes up a suspended run', () => {
    expect(resumable('suspended', false)).toBe(true);
  });

  it('does not take up a run that is not suspended', () => {
    expect(resumable('claimed', false)).toBe(false);
    expect(resumable('completed', false)).toBe(false);
  });
});

describe('takenUpOnAnswer', () => {
  it("takes up the task's current run once nobody owes an answer", () => {
    expect(
      takenUpOnAnswer('run_1', { currentRunId: 'run_1', awaitsPerson: false }),
    ).toBe(true);
  });

  it('takes up no run while a person owes an answer, nor a run the task left', () => {
    expect(
      takenUpOnAnswer('run_1', { currentRunId: 'run_1', awaitsPerson: true }),
    ).toBe(false);
    expect(
      takenUpOnAnswer('run_1', { currentRunId: 'run_2', awaitsPerson: false }),
    ).toBe(false);
  });
});
