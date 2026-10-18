import { costedRecord, endedRecord } from '@insights/domain/runs.fake-spec';
import { runSizeOf, sizeOf } from '@insights/domain/services/run-size';
import { describe, expect, it } from 'vitest';

describe('sizeOf', () => {
  it('tells a run’s size by the lines its changes removed and added', () => {
    expect(sizeOf(costedRecord('run_1', { changedLines: 50 }))).toBe('small');
    expect(sizeOf(costedRecord('run_2', { changedLines: 51 }))).toBe('medium');
    expect(sizeOf(costedRecord('run_3', { changedLines: 401 }))).toBe('large');
  });

  it('tells a run that changed no lines by its steps', () => {
    expect(sizeOf(costedRecord('run_1', { steps: 20 }))).toBe('small');
    expect(sizeOf(costedRecord('run_2', { steps: 80 }))).toBe('medium');
    expect(sizeOf(costedRecord('run_3', { steps: 81 }))).toBe('large');
  });

  it('cannot tell the size of a run whose usage is not yet recorded', () => {
    expect(sizeOf(endedRecord('run_1'))).toBeNull();
  });

  it('reads only the sizes it knows', () => {
    expect(runSizeOf(' medium ')).toBe('medium');
    expect(runSizeOf('huge')).toBeNull();
  });
});
