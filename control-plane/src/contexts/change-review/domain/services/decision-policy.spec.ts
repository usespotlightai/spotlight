import { mayRecordDecisions } from '@change-review/domain/services/decision-policy';
import { describe, expect, it } from 'vitest';

const RUN = { taskId: 'task_1', trial: false, decisions: true };
const TASK = { reviewing: false };

describe('which runs may record decisions', () => {
  it('lets a run of its own task on a station that keeps decisions record them', () => {
    expect(mayRecordDecisions(RUN, TASK)).toBeNull();
  });

  it('refuses a run of no task, and a trial', () => {
    expect(mayRecordDecisions({ ...RUN, taskId: null }, null)).toBe(
      'works-no-task',
    );
    expect(mayRecordDecisions({ ...RUN, trial: true }, TASK)).toBe(
      'works-no-task',
    );
  });

  it('refuses a run of a station that keeps no decisions', () => {
    expect(mayRecordDecisions({ ...RUN, decisions: false }, TASK)).toBe(
      'station-keeps-none',
    );
  });

  it('refuses a task that reviews a pull request', () => {
    expect(mayRecordDecisions(RUN, { reviewing: true })).toBe(
      'reviews-pull-request',
    );
  });
});
