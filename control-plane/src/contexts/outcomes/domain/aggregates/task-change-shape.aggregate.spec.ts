import { TaskChangeShape } from '@outcomes/domain/aggregates/task-change-shape.aggregate';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const shapeAt = (title: string, at: string) => ({
  changeTitles: [title],
  changeIntents: [''],
  at: new Date(at),
});

describe('TaskChangeShape', () => {
  it('keeps the latest stack’s cohorts, however late an earlier one arrives', () => {
    const shaped = TaskChangeShape.create({
      taskId: TaskId.of('task_1'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      shape: shapeAt('Second', '2026-09-30T10:00:00Z'),
    });

    expect(shaped.withShape(shapeAt('First', '2026-09-30T09:00:00Z'))).toBe(
      shaped,
    );
    expect(
      shaped.withShape(shapeAt('Third', '2026-09-30T11:00:00Z')).shape
        .changeTitles,
    ).toEqual(['Third']);
  });
});
