import { TaskBranch } from '@domain/services/task-branch';
import { describe, expect, it } from 'vitest';

describe('TaskBranch', () => {
  it('names one branch for the task', () => {
    expect(TaskBranch.for('task_1')).toBe('spotlight/task_1');
  });

  // Every station adds to the same change, so the name cannot vary by station.
  it('is the same branch wherever the task stands', () => {
    expect(TaskBranch.for('task_1')).toBe(TaskBranch.for('task_1'));
  });
});
