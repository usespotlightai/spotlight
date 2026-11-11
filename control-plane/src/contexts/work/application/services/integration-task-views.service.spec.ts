import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { ChatMarksPort } from '@work/application/ports/chat-marks.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { ApprovalAsked } from '@work/application/rendering/approval-asked';
import { IntegrationTaskViews } from '@work/application/services/integration-task-views.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalOrigin } from '@work/domain/value-objects/proposal-origin.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: '#a3a8b0',
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
  }).markedBy(Mark.of('slack.thread', '170.1'), new Date(0));

const line = {
  teamId: TeamId.of('team_1'),
  key: { value: 'delivery' },
  stationAt: () => ({ name: { value: 'Triage' }, key: { value: 'triage' } }),
} as unknown as LineMap;

const taskViews = (
  found: LineMap | null = line,
  ambient: readonly Mark[] = [],
) =>
  new IntegrationTaskViews(
    {
      findByStation: async () => found,
    } as unknown as LineMapsPort,
    { ambientOf: async () => ambient } satisfies ChatMarksPort,
  );

describe('IntegrationTaskViews', () => {
  it('addresses a task from a chat by the ambient marks of the chat, under its own marks', async () => {
    const ambient = [
      Mark.of('slack.channel', 'C1'),
      Mark.of('slack.thread_ts', '1700.1'),
    ];

    const proposed = Task.add({
      line: delivery(),
      at: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      proposedIn: ProposalOrigin.of({
        chatId: ChatId.of('chat_1'),
        position: MessagePosition.of(1),
      }),
      now: NOW,
      newId: () => 'task_1',
    }).markedBy(Mark.of('slack.thread', '170.1'), new Date(0));

    const view = await taskViews(line, ambient).of(proposed);
    const plain = await taskViews(line, ambient).of(task());

    expect(plain?.marks).toEqual({ 'slack.thread': '170.1' });

    expect(view?.marks).toEqual({
      'slack.channel': 'C1',
      'slack.thread_ts': '1700.1',
      'slack.thread': '170.1',
    });
  });

  it('says where a task is, in words an integration can use', async () => {
    await expect(taskViews().of(task())).resolves.toEqual({
      taskId: 'task_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      title: 'Fix the queue',
      pullRequest: null,
      pullRequests: [],
      line: 'delivery',
      station: 'Triage',
      stationKey: 'triage',
      marks: { 'slack.thread': '170.1' },
      waiting: null,
    });
  });

  it('carries the question whose answer is pending', async () => {
    const asked = task().askedAbout(
      {
        line: null,
        body: TaskNoteBody.of('Which queue should I drain?'),
        at: NOW,
        voice: Voice.station(),
      },
      null,
    );

    const view = await taskViews().of(asked);

    expect(view?.waiting?.body).toBe('Which queue should I drain?');
    expect(view?.waiting?.conversationId).toMatch(/^task_1:/);
    expect(view?.waiting?.awaitsApproval).toBe(false);
  });

  it('carries the files of the question, for an integration to send', async () => {
    const asked = task().askedAbout(
      {
        line: null,
        body: TaskNoteBody.of('Here are the screenshots.'),
        at: NOW,
        voice: Voice.station(),
        attachments: [
          Attachment.of({
            id: 'file_1',
            name: 'shot.png',
            contentType: 'image/png',
            size: 3,
          }),
        ],
      },
      null,
    );

    const view = await taskViews().of(asked);

    expect(view?.waiting?.attachments).toEqual([
      { id: 'file_1', name: 'shot.png', contentType: 'image/png', size: 3 },
    ]);
  });

  it('says when the pending answer is the approval of a tool call', async () => {
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
        line: null,
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

    const view = await taskViews().of(asked);

    expect(view?.waiting?.awaitsApproval).toBe(true);
    expect(view?.waiting?.body).not.toContain('**');
    expect(view?.waiting?.body).toContain('`linear.comment`');
    expect(view?.waiting?.body).toContain('issue: `ENG-12`');
    expect(view?.waiting?.body).toContain('body:\n```\nFixed.\nIn #41.\n```');
  });

  it('binds nothing for a task off every line', async () => {
    await expect(taskViews(null).of(task())).resolves.toBeNull();
  });
});
