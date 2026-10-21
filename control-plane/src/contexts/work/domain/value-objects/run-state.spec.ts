import {
  activityOf,
  isStopping,
  type RunActivityFacts,
  resumable,
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

describe('activityOf', () => {
  const facts = (over: Partial<RunActivityFacts> = {}): RunActivityFacts => ({
    state: 'claimed',
    stopRequested: false,
    awaitsPerson: false,
    current: true,
    ...over,
  });

  it('says a run a runner took is working', () => {
    expect(activityOf(facts())).toBe('working');
  });

  it('says a run that waits for a runner is queued', () => {
    expect(activityOf(facts({ state: 'queued' }))).toBe('queued');
  });

  it('says a run asked to stop is stopping, also while it waited for a person', () => {
    expect(activityOf(facts({ stopRequested: true }))).toBe('stopping');
    expect(
      activityOf(
        facts({ state: 'waiting', stopRequested: true, awaitsPerson: true }),
      ),
    ).toBe('stopping');
  });

  it('says nothing while a person owes an answer', () => {
    expect(
      activityOf(facts({ state: 'waiting', awaitsPerson: true })),
    ).toBeNull();
    expect(activityOf(facts({ awaitsPerson: true }))).toBeNull();
    expect(
      activityOf(facts({ state: 'suspended', awaitsPerson: true })),
    ).toBeNull();
  });

  it('says a paused run works again once the person answered, as the answer takes it up', () => {
    expect(activityOf(facts({ state: 'waiting' }))).toBe('working');
    expect(activityOf(facts({ state: 'suspended' }))).toBe('queued');
  });

  it('says nothing for a paused run that the task no longer runs', () => {
    expect(activityOf(facts({ state: 'waiting', current: false }))).toBeNull();
    expect(
      activityOf(facts({ state: 'suspended', current: false })),
    ).toBeNull();
  });

  it('says nothing for a run that has ended', () => {
    expect(
      activityOf(facts({ state: 'cancelled', stopRequested: true })),
    ).toBeNull();
    expect(activityOf(facts({ state: 'completed' }))).toBeNull();
  });
});

describe('resumable', () => {
  it('takes up a suspended run, and a waiting run nobody asked to stop', () => {
    expect(resumable('suspended', false)).toBe(true);
    expect(resumable('suspended', true)).toBe(true);
    expect(resumable('waiting', false)).toBe(true);
  });

  it('does not take up a waiting run asked to stop, nor a run that is not paused', () => {
    expect(resumable('waiting', true)).toBe(false);
    expect(resumable('claimed', false)).toBe(false);
    expect(resumable('completed', false)).toBe(false);
  });
});
