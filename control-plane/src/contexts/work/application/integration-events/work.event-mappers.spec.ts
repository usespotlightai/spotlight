import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WORK_EVENT_MAPPERS } from '@work/application/integration-events/work.event-mappers';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { DispatchBriefed } from '@work/domain/events/dispatch-briefed.event';
import { DispatchEnded } from '@work/domain/events/dispatch-ended.event';
import { DispatchSuperseded } from '@work/domain/events/dispatch-superseded.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { TaskPassed } from '@work/domain/events/task-passed.event';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import {
  DispatchEnding,
  type DispatchOutcome,
} from '@work/domain/value-objects/dispatch-ending.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { describe, expect, it } from 'vitest';

const RECORDED_AT = new Date('2026-10-02T09:30:00.000Z');

const published = (event: DomainEvent) =>
  WORK_EVENT_MAPPERS.filter((each) => each.from === event.kind).flatMap(
    (each) => {
      const mapped = each.map(event, RECORDED_AT);

      return mapped ? [mapped] : [];
    },
  );

const dispatchEnded = (
  outcome: DispatchOutcome,
  failure: string | null = null,
  stopped = false,
) =>
  new DispatchEnded(
    RUN,
    WORKSPACE,
    TASK,
    StationId.of('station_1'),
    DispatchEnding.of({ endedAt: RECORDED_AT, outcome, failure, stopped }),
  );

const TASK = TaskId.of('task_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const RUN = RunId.of('run_1');

describe('WORK_EVENT_MAPPERS', () => {
  it('publishes a task opening, on which team and line, by whom and when', () => {
    expect(
      published(
        new TaskOpened(
          TASK,
          WORKSPACE,
          TeamId.of('team_1'),
          LineId.of('line_1'),
          StationId.of('station_1'),
          UserId.of('user_1'),
          new Date('2026-09-26T09:00:00Z'),
          false,
        ),
      ),
    ).toEqual([
      {
        kind: 'work.task-opened.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        lineId: 'line_1',
        stationId: 'station_1',
        by: 'user_1',
        at: '2026-09-26T09:00:00.000Z',
      },
    ]);
  });

  it('publishes a pull request opening, and when', () => {
    expect(
      published(
        new PullRequestOpened(
          TASK,
          WORKSPACE,
          TeamId.of('team_1'),
          PullRequestUrl.of('https://github.com/acme/api/pull/1'),
          new Date('2026-09-26T09:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.pull-request-opened.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        url: 'https://github.com/acme/api/pull/1',
        at: '2026-09-26T09:00:00.000Z',
      },
    ]);
  });

  it('publishes the pull request a review task reviews', () => {
    expect(
      published(
        new PullRequestReviewTaken(
          TASK,
          WORKSPACE,
          TeamId.of('team_1'),
          PullRequestUrl.of('https://github.com/acme/api/pull/1'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.pull-request-review-taken.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        url: 'https://github.com/acme/api/pull/1',
      },
    ]);
  });

  it('publishes a run passing its task on to another station', () => {
    expect(
      published(
        new TaskPassed(
          TASK,
          WORKSPACE,
          RUN,
          StationId.of('station_1'),
          StationId.of('station_2'),
          new Date('2026-09-26T09:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.task-passed.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        runId: 'run_1',
        from: 'station_1',
        to: 'station_2',
        at: '2026-09-26T09:00:00.000Z',
      },
    ]);
  });

  it('publishes a task failure with its team, source, code and how often it repeated', () => {
    expect(
      published(
        new TaskFailed(
          TASK,
          WORKSPACE,
          TeamId.of('team_1'),
          StationId.of('station_1'),
          TaskFailure.fromHook('notify', 'loop').again().again(),
          null,
          new Date('2026-09-26T09:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.task-failed.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        stationId: 'station_1',
        runId: null,
        source: 'hook:notify',
        code: 'loop',
        occurrences: 3,
        at: '2026-09-26T09:00:00.000Z',
      },
    ]);
  });

  it('publishes a task put to a person, and when', () => {
    expect(
      published(
        new TaskAsked(
          TASK,
          WORKSPACE,
          StationId.of('station_1'),
          null,
          new Date('2026-09-26T09:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.task-asked.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        stationId: 'station_1',
        at: '2026-09-26T09:00:00.000Z',
      },
    ]);
  });

  it('publishes who started a chat, on which team and when', () => {
    expect(
      published(
        new ChatStarted(
          ChatId.of('chat_1'),
          WORKSPACE,
          TeamId.of('team_1'),
          UserId.of('user_1'),
          new Date('2026-09-26T09:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.chat-started.v1',
        chatId: 'chat_1',
        workspaceId: 'ws_1',
        teamId: 'team_1',
        by: 'user_1',
        at: '2026-09-26T09:00:00.000Z',
      },
    ]);
  });

  it('publishes a task moving between stations by their keys, and when', () => {
    expect(
      published(
        new TaskMoved(
          TASK,
          WORKSPACE,
          {
            id: StationId.of('station_implementation'),
            key: StationKey.of('implementation'),
          },
          {
            id: StationId.of('station_code_review'),
            key: StationKey.of('code-review'),
          },
          new Date('2026-09-26T09:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.task-moved.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        from: 'implementation',
        to: 'code-review',
        at: '2026-09-26T09:00:00.000Z',
      },
    ]);
  });

  it('says how a dispatched run ended', () => {
    const ended = (event: DomainEvent) => published(event)[0]?.outcome;

    expect(ended(dispatchEnded('completed'))).toBe('completed');
    expect(ended(dispatchEnded('failed', 'exited'))).toBe('failed');
    expect(ended(dispatchEnded('exhausted', 'runner-lost'))).toBe('exhausted');
    expect(ended(dispatchEnded('cancelled'))).toBe('cancelled');
  });

  it('says which station a dispatched run worked at, which failure ended it and whether a person stopped it', () => {
    expect(published(dispatchEnded('completed', null, true))).toEqual([
      {
        kind: 'work.run-ended.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: 'task_1',
        stationId: 'station_1',
        outcome: 'completed',
        failure: null,
        stopped: true,
        asked: false,
      },
    ]);
    expect(published(dispatchEnded('exhausted', 'runner-lost'))[0]).toEqual(
      expect.objectContaining({ failure: 'runner-lost', stopped: false }),
    );
  });

  it('publishes a run its task superseded', () => {
    expect(
      published(new DispatchSuperseded(RUN, WORKSPACE, TASK, RECORDED_AT)),
    ).toEqual([
      {
        kind: 'work.run-superseded.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: 'task_1',
        at: RECORDED_AT.toISOString(),
      },
    ]);
  });

  it('publishes what a person did to a task, who did it and after which run', () => {
    expect(
      published(
        new TaskActedOn(
          TASK,
          WORKSPACE,
          StationId.of('station_1'),
          'sent-back',
          UserId.of('user_1'),
          RUN,
          new Date('2026-09-26T09:00:00Z'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.task-acted-on.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        stationId: 'station_1',
        action: 'sent-back',
        by: 'user_1',
        afterRunId: 'run_1',
        at: '2026-09-26T09:00:00.000Z',
        tool: null,
        server: null,
      },
    ]);
  });

  it('publishes the tool a person dismissed, and its server', () => {
    expect(
      published(
        new TaskActedOn(
          TASK,
          WORKSPACE,
          StationId.of('station_1'),
          'dismissed',
          UserId.of('user_1'),
          RUN,
          new Date('2026-09-26T09:00:00Z'),
          CalledTool.of({ server: 'linear', tool: 'create_issue' }),
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        action: 'dismissed',
        tool: 'create_issue',
        server: 'linear',
      }),
    ]);
  });

  it('publishes the memories a run was briefed with, and never those the cap omitted', () => {
    expect(
      published(
        new DispatchBriefed(
          RUN,
          WORKSPACE,
          TASK,
          BriefedMemories.of({
            briefed: [{ id: 'memory_1', handle: 'M-1' }],
            omitted: [{ id: 'memory_2', handle: 'M-2' }],
          }),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.run-briefed.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: 'task_1',
        memories: ['memory_1'],
      },
    ]);
  });
});
