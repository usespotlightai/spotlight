import { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const shapeOf = (
  title: string,
  stackStartedAt: string,
  repository: string | null = 'api',
  at: string = stackStartedAt,
) => ({
  repository,
  stackStartedAt: new Date(stackStartedAt),
  changeTitles: [title],
  changeIntents: [''],
  at: new Date(at),
});

const shapedWith = (shape: ReturnType<typeof shapeOf>) =>
  TaskChangeShape.create({
    taskId: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    shape,
  });

const pullRequestIn = (repository: string) =>
  PullRequestUrl.of(`https://github.com/acme/${repository}/pull/7`);

describe('TaskChangeShape', () => {
  it('keeps the latest stack’s cohorts, however late an earlier stack arrives', () => {
    const shaped = shapedWith(shapeOf('Second', '2026-09-30T10:00:00Z'));

    expect(shaped.withShape(shapeOf('First', '2026-09-30T09:00:00Z'))).toBe(
      shaped,
    );
    expect(
      shaped
        .withShape(shapeOf('Third', '2026-09-30T11:00:00Z'))
        .shapeOf(pullRequestIn('api'))?.changeTitles,
    ).toEqual(['Third']);
  });

  it('keeps a redraft of the same stack', () => {
    const shaped = shapedWith(shapeOf('Draft', '2026-09-30T10:00:00Z'));

    expect(
      shaped
        .withShape(
          shapeOf(
            'Redraft',
            '2026-09-30T10:00:00Z',
            'api',
            '2026-09-30T10:05:00Z',
          ),
        )
        .shapeOf(pullRequestIn('api'))?.changeTitles,
    ).toEqual(['Redraft']);
  });

  it('types each pull request from the stack of its own repository', () => {
    const shaped = shapedWith(
      shapeOf('Api change', '2026-09-30T10:00:00Z'),
    ).withShape(shapeOf('Web change', '2026-09-30T11:00:00Z', 'web'));

    expect(shaped.shapeOf(pullRequestIn('api'))?.changeTitles).toEqual([
      'Api change',
    ]);
    expect(shaped.shapeOf(pullRequestIn('web'))?.changeTitles).toEqual([
      'Web change',
    ]);
    expect(shaped.shapeOf(pullRequestIn('docs'))).toBeNull();
  });

  it('names a repository the way GitHub does, whatever its case', () => {
    const shaped = shapedWith(
      shapeOf('Api change', '2026-09-30T10:00:00Z', 'api'),
    );

    expect(shaped.shapeOf(pullRequestIn('Api'))?.changeTitles).toEqual([
      'Api change',
    ]);
    expect(
      shaped
        .withShape(shapeOf('Later', '2026-09-30T11:00:00Z', 'API'))
        .shapeOf(pullRequestIn('api'))?.changeTitles,
    ).toEqual(['Later']);
    expect(() =>
      TaskChangeShape.rehydrate({
        taskId: TaskId.of('task_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        shapes: [
          shapeOf('One', '2026-09-30T10:00:00Z', 'api'),
          shapeOf('Two', '2026-09-30T11:00:00Z', 'Api'),
        ],
        version: 1,
      }),
    ).toThrow('keeps one shape for each repository');
  });

  it('types any pull request from a stack that names no repository', () => {
    const shaped = shapedWith(shapeOf('Change', '2026-09-30T10:00:00Z', null));

    expect(shaped.shapeOf(pullRequestIn('docs'))?.changeTitles).toEqual([
      'Change',
    ]);
  });

  it('refuses two shapes for one repository', () => {
    expect(() =>
      TaskChangeShape.rehydrate({
        taskId: TaskId.of('task_1'),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        shapes: [
          shapeOf('One', '2026-09-30T10:00:00Z'),
          shapeOf('Two', '2026-09-30T11:00:00Z'),
        ],
        version: 1,
      }),
    ).toThrow('keeps one shape for each repository');
  });
});
