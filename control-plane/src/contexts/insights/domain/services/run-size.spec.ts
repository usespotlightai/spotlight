import { runSizeOf, sizeOf } from '@insights/domain/services/run-size';
import { costedRecord, endedRecord } from '@insights/runs.fake-spec';
import { describe, expect, it } from 'vitest';

describe('sizeOf', () => {
  it('tells a run’s size by the lines its changes removed and added', () => {
    expect(sizeOf(costedRecord('run_1', { changedLines: 50 }).usage)).toBe(
      'small',
    );
    expect(sizeOf(costedRecord('run_2', { changedLines: 51 }).usage)).toBe(
      'medium',
    );
    expect(sizeOf(costedRecord('run_3', { changedLines: 401 }).usage)).toBe(
      'large',
    );
  });

  it('tells a run that changed no lines by its steps', () => {
    expect(sizeOf(costedRecord('run_1', { steps: 20 }).usage)).toBe('small');
    expect(sizeOf(costedRecord('run_2', { steps: 80 }).usage)).toBe('medium');
    expect(sizeOf(costedRecord('run_3', { steps: 81 }).usage)).toBe('large');
  });

  it('cannot tell the size of a run whose usage is not yet recorded', () => {
    expect(sizeOf(endedRecord('run_1').usage)).toBeNull();
  });

  it('reads only the sizes it knows', () => {
    expect(runSizeOf(' medium ')).toBe('medium');
    expect(runSizeOf('huge')).toBeNull();
  });
});
