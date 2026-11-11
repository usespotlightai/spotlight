import { WebReviewLinks } from '@change-review/infrastructure/links/web-review.links';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

describe('WebReviewLinks', () => {
  it('links a run’s change stack page on the web app', () => {
    expect(
      new WebReviewLinks('https://app.example/').changeStackOf({
        slug: 'acme',
        teamId: TeamId.of('t 1'),
        runId: RunId.of('r1'),
      }),
    ).toBe('https://app.example/w/acme/team/t%201/runs/r1/changes');
  });

  it('links the decisions on a task’s page', () => {
    expect(
      new WebReviewLinks('https://app.example').decisionsOf({
        slug: 'acme',
        teamId: TeamId.of('t1'),
        taskId: TaskId.of('task 1'),
      }),
    ).toBe('https://app.example/w/acme/team/t1/tasks/task%201#decisions');
  });
});
