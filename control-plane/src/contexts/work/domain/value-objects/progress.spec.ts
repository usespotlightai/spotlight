import {
  progressOfCurrentRun,
  progressOfTaskRun,
} from '@work/domain/value-objects/progress';
import { describe, expect, it } from 'vitest';

describe('progressOfTaskRun', () => {
  it('shows no progress for a superseded run', () => {
    expect(
      progressOfTaskRun(
        'superseded',
        { progress: 'in-progress', resumable: false },
        false,
      ),
    ).toBeNull();
  });

  it('says a resumable run is queued again once the answer takes it up, and not before', () => {
    const suspended = { progress: null, resumable: true };

    expect(progressOfTaskRun('suspended', suspended, true)).toBe('queued');
    expect(progressOfTaskRun('suspended', suspended, false)).toBeNull();
  });
});

describe('progressOfCurrentRun', () => {
  it('says a run Runs does not report yet is queued', () => {
    expect(progressOfCurrentRun(null, false)).toBe('queued');
  });
});
