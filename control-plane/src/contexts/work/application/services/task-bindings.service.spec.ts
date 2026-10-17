import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ApprovalAsked } from '@work/application/rendering/approval-asked';
import { TaskBindings } from '@work/application/services/task-bindings.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const task = () =>
  Task.add({
    line: delivery(),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => 'task_1',
  }).markedBy(Mark.of('slack.thread', '170.1'));

const line = {
  teamId: TeamId.of('team_1'),
  key: { value: 'delivery' },
  stationAt: () => ({ name: { value: 'Triage' }, key: { value: 'triage' } }),
} as unknown as Line;

const binding = (found: Line | null = line) =>
  new TaskBindings({
    findByStation: async () => found,
  } as unknown as LineRepository);

describe('TaskBindings', () => {
  it('says where a task is, in words an outside host can use', async () => {
    await expect(binding().of(task())).resolves.toEqual({
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      line: 'delivery',
      station: 'Triage',
      stationKey: 'triage',
      marks: { 'slack.thread': '170.1' },
      waiting: null,
    });
  });

  it('carries the question a person is owed an answer to', async () => {
    const asked = task().askedAbout(
      {
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Which queue should I drain?'),
        at: NOW,
        voice: Voice.station(),
      },
      null,
    );

    const bound = await binding().of(asked);

    expect(bound?.waiting?.said).toBe('Which queue should I drain?');
    expect(bound?.waiting?.conversationId).toMatch(/^task_1:/);
    expect(bound?.waiting?.awaitsApproval).toBe(false);
  });

  it('says when what a person is owed is a tool call to approve', async () => {
    const asked = Task.rehydrate({
      ...task(),
      currentRunId: RunId.of('run_1'),
    }).clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(
          Tool.of('linear.comment'),
          ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.' }),
        ),
      ),
      ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
      {
        station: StationName.of('Triage'),
        body: TaskNoteBody.of(
          ApprovalAsked.body(
            DeclaredTool.of({
              tool: Tool.of('linear.comment'),
              description: 'Comment on the issue.',
            }),
            ToolCall.of(
              Tool.of('linear.comment'),
              ToolInputs.of({ issue: 'ENG-12', body: 'Fixed.\nIn #41.' }),
            ),
            ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
          ),
        ),
        at: NOW,
        voice: Voice.station(RunId.of('run_1')),
      },
      RunId.of('run_1'),
      null,
    ).task;

    const bound = await binding().of(asked);

    expect(bound?.waiting?.awaitsApproval).toBe(true);
    expect(bound?.waiting?.said).not.toContain('**');
    expect(bound?.waiting?.said).toContain('`linear.comment`');
    expect(bound?.waiting?.said).toContain('issue: `ENG-12`');
    expect(bound?.waiting?.said).toContain('body:\n```\nFixed.\nIn #41.\n```');
  });

  it('binds nothing for a task off every line', async () => {
    await expect(binding(null).of(task())).resolves.toBeNull();
  });
});
