import { WebReviewLinks } from '@change-review/infrastructure/links/web-review.links';
import { describe, expect, it } from 'vitest';

describe('WebReviewLinks', () => {
  it('links a run’s change stack page on the web app', () => {
    expect(
      new WebReviewLinks('https://app.example/').changeStackOf({
        slug: 'acme',
        teamId: 't 1',
        runId: 'r1',
      }),
    ).toBe('https://app.example/w/acme/team/t%201/runs/r1/changes');
  });

  it('links the decisions on a task’s page', () => {
    expect(
      new WebReviewLinks('https://app.example').decisionsOf({
        slug: 'acme',
        teamId: 't1',
        taskId: 'task 1',
      }),
    ).toBe('https://app.example/w/acme/team/t1/tasks/task%201#decisions');
  });
});
