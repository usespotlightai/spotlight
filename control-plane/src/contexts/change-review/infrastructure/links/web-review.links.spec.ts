import { WebReviewLinks } from '@change-review/infrastructure/links/web-review.links';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

describe('WebReviewLinks', () => {
  it('links the changes page of a task on the web app', () => {
    expect(
      new WebReviewLinks('https://app.example/').changeStackOf({
        slug: 'acme',
        teamId: TeamId.of('t 1'),
        taskId: TaskId.of('task 1'),
        repository: null,
      }),
    ).toBe('https://app.example/w/acme/team/t%201/tasks/task%201/changes');
  });

  it('opens the changes page on the repository of the stack', () => {
    expect(
      new WebReviewLinks('https://app.example').changeStackOf({
        slug: 'acme',
        teamId: TeamId.of('t1'),
        taskId: TaskId.of('task_1'),
        repository: 'web app&docs',
      }),
    ).toBe(
      'https://app.example/w/acme/team/t1/tasks/task_1/changes?repository=web+app%26docs',
    );
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
