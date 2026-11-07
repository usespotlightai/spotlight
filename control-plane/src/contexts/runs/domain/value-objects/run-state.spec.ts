import { isStopping, resumable } from '@runs/domain/value-objects/run-state';
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

describe('resumable', () => {
  it('takes up a suspended run', () => {
    expect(resumable('suspended', false)).toBe(true);
  });

  it('does not take up a run that is not suspended', () => {
    expect(resumable('claimed', false)).toBe(false);
    expect(resumable('completed', false)).toBe(false);
  });
});
