import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WORK_PUBLICATIONS } from '@work/application/integration-events/work.publications';
import { ChatStarted } from '@work/domain/events/chat-started.event';
import { LineRedefined } from '@work/domain/events/line-redefined.event';
import { LineRetired } from '@work/domain/events/line-retired.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { PullRequestReviewTaken } from '@work/domain/events/pull-request-review-taken.event';
import { ReplayDigested } from '@work/domain/events/replay-digested.event';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunBriefed } from '@work/domain/events/run-briefed.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunDigested } from '@work/domain/events/run-digested.event';
import { RunSuperseded } from '@work/domain/events/run-superseded.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { SearchDigested } from '@work/domain/events/search-digested.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskHandedOn } from '@work/domain/events/task-handed-on.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { CalledTool } from '@work/domain/value-objects/called-tool.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { Money } from '@work/domain/value-objects/money.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { Tokens } from '@work/domain/value-objects/tokens.vo';
import { ToolUse } from '@work/domain/value-objects/tool-use.vo';
import { describe, expect, it } from 'vitest';

const RECORDED_AT = new Date('2026-10-02T09:30:00.000Z');

const published = (event: DomainEvent) =>
  WORK_PUBLICATIONS.filter((each) => each.from === event.kind).map((each) =>
    each.publish(event, RECORDED_AT),
  );

const TASK = TaskId.of('task_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const RUN = RunId.of('run_1');
const SUBJECT = RunSubject.task(
  TASK,
  StationId.of('station_1'),
  TaskRevision.of(0),
);

describe('WORK_PUBLICATIONS', () => {
  it('publishes which stations a redefined or retired line had and has', () => {
    const change = ConfigurationChange.updated(
      { resource: 'line', id: 'line_1', key: 'default' },
      attributedIn(),
    );
    const stations = [StationId.of('station_1'), StationId.of('station_2')];
    const told = {
      kind: 'work.line-redefined.v1',
      lineId: 'line_1',
      workspaceId: 'ws_1',
      teamId: 'team_1',
      stationIds: ['station_1', 'station_2'],
    };

    expect(
      published(
        new LineRedefined(
          LineId.of('line_1'),
          WORKSPACE,
          TeamId.of('team_1'),
          LineKey.of('default'),
          change,
          stations,
        ),
      ),
    ).toEqual([told]);
    expect(
      published(
        new LineRetired(
          LineId.of('line_1'),
          WORKSPACE,
          TeamId.of('team_1'),
          LineKey.of('default'),
          change,
          stations,
        ),
      ),
    ).toEqual([told]);
  });

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
          PullRequestUrl.of('https://github.com/acme/api/pull/1'),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.pull-request-review-taken.v1',
        taskId: 'task_1',
        workspaceId: 'ws_1',
        url: 'https://github.com/acme/api/pull/1',
      },
    ]);
  });

  it('publishes what a run cost once it is digested', () => {
    expect(
      published(
        new RunDigested(
          RUN,
          WORKSPACE,
          TASK,
          60_000,
          12,
          1,
          40,
          40_000,
          200_000,
          Money.of(0.42, 'USD'),
          Tokens.of({ input: 1_200, output: 900, cacheRead: 80_000 }),
          ToolUse.of({
            servers: [
              {
                server: 'linear',
                calls: 2,
                failed: 1,
                latency: LatencyHistogram.timing([300, 900]),
                lastCallFailed: true,
              },
            ],
            skills: ['our-migrations'],
          }),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.run-digested.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: 'task_1',
        ms: 60_000,
        steps: 12,
        faults: 1,
        changedLines: 40,
        used: 40_000,
        size: 200_000,
        cost: 0.42,
        currency: 'USD',
        inputTokens: 1_200,
        outputTokens: 900,
        cacheReadTokens: 80_000,
        cacheWriteTokens: null,
        servers: [
          {
            server: 'linear',
            calls: 2,
            failed: 1,
            latency: LatencyHistogram.timing([300, 900]).counts,
            lastCallFailed: true,
          },
        ],
        skillsRead: ['our-migrations'],
      },
    ]);
  });

  it('publishes what a replay cost as a replay’s digest, naming the run it replayed', () => {
    expect(
      published(
        new ReplayDigested(
          RUN,
          WORKSPACE,
          RunId.of('run_0'),
          60_000,
          12,
          8,
          Money.of(0.42, 'USD'),
          Tokens.of({ input: 1_200, output: 900 }),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.replay-digested.v1',
        runId: 'run_1',
        replayOf: 'run_0',
        workspaceId: 'ws_1',
        ms: 60_000,
        steps: 12,
        changedLines: 8,
        cost: 0.42,
        currency: 'USD',
        inputTokens: 1_200,
        outputTokens: 900,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      },
    ]);
  });

  it('publishes what a search run cost as a search’s digest, naming its search', () => {
    expect(
      published(
        new SearchDigested(
          RUN,
          WORKSPACE,
          SearchId.of('search_1'),
          30_000,
          9,
          [Money.of(0.12, 'USD')],
          2,
          Tokens.of({ input: 800, output: 400 }),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.search-run-digested.v1',
        runId: 'run_1',
        searchId: 'search_1',
        workspaceId: 'ws_1',
        ms: 30_000,
        steps: 9,
        spentCosts: [{ amount: 0.12, currency: 'USD' }],
        unpricedCalls: 2,
        inputTokens: 800,
        outputTokens: 400,
        cacheReadTokens: null,
        cacheWriteTokens: null,
      },
    ]);
  });

  it('publishes a run handing its task on to another station', () => {
    expect(
      published(
        new TaskHandedOn(
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
        kind: 'work.task-handed-on.v1',
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
          StationKey.of('implementation'),
          StationKey.of('code-review'),
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

  it('says how a run ended', () => {
    const ended = (event: DomainEvent) => published(event)[0]?.outcome;

    expect(
      ended(
        new RunCompleted(
          RUN,
          WORKSPACE,
          SUBJECT,
          RunOutcome.of({ exitCode: 0, failed: false }),
          null,
          null,
          null,
          1,
        ),
      ),
    ).toBe('completed');
    expect(
      ended(
        new RunCompleted(
          RUN,
          WORKSPACE,
          SUBJECT,
          RunOutcome.of({ exitCode: 1, failed: true }),
          null,
          null,
          null,
          1,
        ),
      ),
    ).toBe('failed');
    expect(
      ended(
        new RunCompleted(
          RUN,
          WORKSPACE,
          SUBJECT,
          RunOutcome.refused([{ saying: 'The hook core/freeze refused.' }]),
          null,
          null,
          null,
          1,
        ),
      ),
    ).toBe('failed');
    expect(
      ended(
        new RunCompleted(
          RUN,
          WORKSPACE,
          SUBJECT,
          RunOutcome.stopped(130),
          null,
          null,
          null,
          1,
        ),
      ),
    ).toBe('completed');
    expect(ended(new RunAbandoned(RUN, WORKSPACE, SUBJECT, 3, 3))).toBe(
      'abandoned',
    );
    expect(ended(new RunWithdrawn(RUN, WORKSPACE, SUBJECT, 1))).toBe(
      'withdrawn',
    );
  });

  it('publishes a replay’s end as a replay’s, never as a run’s', () => {
    const replay = RunSubject.replay(
      RunId.of('run_0'),
      TaskId.of('task_1'),
      StationId.of('station_1'),
      TeamId.of('team_1'),
    );

    expect(
      published(
        new RunCompleted(
          RUN,
          WORKSPACE,
          replay,
          RunOutcome.of({ exitCode: 0, failed: false }),
          null,
          Declaration.of({ next: 'review', note: 'Over to you.' }),
          null,
          1,
          true,
        ),
      ),
    ).toEqual([
      {
        kind: 'work.replay-ended.v1',
        runId: 'run_1',
        replayOf: 'run_0',
        workspaceId: 'ws_1',
        outcome: 'completed',
        failure: null,
        stopped: false,
        asked: true,
        next: 'review',
        note: 'Over to you.',
      },
    ]);
    expect(
      published(
        new RunAbandoned(RUN, WORKSPACE, replay, 3, 3, false, 'runner-lost'),
      ),
    ).toEqual([
      {
        kind: 'work.replay-ended.v1',
        runId: 'run_1',
        replayOf: 'run_0',
        workspaceId: 'ws_1',
        outcome: 'abandoned',
        failure: 'runner-lost',
        stopped: false,
        asked: false,
        next: null,
        note: null,
      },
    ]);
    expect(
      published(new RunWithdrawn(RUN, WORKSPACE, replay, 1)).map(
        (each) => each.kind,
      ),
    ).toEqual(['work.replay-ended.v1']);
  });

  it('publishes a search run’s end as a search’s, never as a run’s or a replay’s', () => {
    const search = RunSubject.search(
      SearchId.of('search_1'),
      SearchIteration.of(2),
      StationId.of('station_1'),
      TeamId.of('team_1'),
    );

    expect(
      published(
        new RunCompleted(
          RUN,
          WORKSPACE,
          search,
          RunOutcome.of({ exitCode: 0, failed: false }),
          null,
          Declaration.of({ next: 'review' }),
          null,
          1,
          true,
        ),
      ),
    ).toEqual([
      {
        kind: 'work.search-run-ended.v1',
        runId: 'run_1',
        searchId: 'search_1',
        iteration: 2,
        workspaceId: 'ws_1',
        teamId: 'team_1',
        stationId: 'station_1',
        outcome: 'completed',
        failure: null,
        asked: true,
        stopped: false,
        started: true,
        endedAt: '2026-10-02T09:30:00.000Z',
      },
    ]);
    expect(
      published(
        new RunAbandoned(RUN, WORKSPACE, search, 3, 3, false, 'runner-lost'),
      ),
    ).toEqual([
      expect.objectContaining({
        kind: 'work.search-run-ended.v1',
        outcome: 'abandoned',
        failure: 'runner-lost',
        asked: false,
      }),
    ]);
    expect(published(new RunWithdrawn(RUN, WORKSPACE, search, 1))).toEqual([
      expect.objectContaining({
        kind: 'work.search-run-ended.v1',
        outcome: 'withdrawn',
        started: false,
      }),
    ]);
    expect(published(new RunWithdrawn(RUN, WORKSPACE, search, 2))).toEqual([
      expect.objectContaining({ outcome: 'withdrawn', started: true }),
    ]);
  });

  it('publishes a run with no task as ending for no task', () => {
    expect(published(new RunWithdrawn(RUN, WORKSPACE, null, 1))).toEqual([
      {
        kind: 'work.run-ended.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: null,
        stationId: null,
        outcome: 'withdrawn',
        failure: null,
        stopped: false,
        asked: false,
      },
    ]);
  });

  it('says which station a run worked at, which failure ended it and whether a person stopped it', () => {
    const fields = (event: DomainEvent) => {
      const [ended] = published(event);
      return {
        stationId: ended?.stationId,
        failure: ended?.failure,
        stopped: ended?.stopped,
      };
    };
    const completed = (outcome: RunOutcome) =>
      new RunCompleted(RUN, WORKSPACE, SUBJECT, outcome, null, null, null, 1);

    expect(fields(completed(RunOutcome.stopped(130)))).toEqual({
      stationId: 'station_1',
      failure: null,
      stopped: true,
    });
    expect(fields(completed(RunOutcome.lost(3)))).toEqual({
      stationId: 'station_1',
      failure: 'runner-lost',
      stopped: false,
    });
  });

  it('publishes a run its task superseded', () => {
    expect(published(new RunSuperseded(RUN, WORKSPACE, SUBJECT))).toEqual([
      {
        kind: 'work.run-superseded.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        taskId: 'task_1',
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
        act: 'sent-back',
        by: 'user_1',
        after: 'run_1',
        at: '2026-09-26T09:00:00.000Z',
        tool: null,
        server: null,
        forApproval: false,
      },
    ]);
  });

  it('publishes the tool a person refused, and its server, as an approval decision', () => {
    expect(
      published(
        new TaskActedOn(
          TASK,
          WORKSPACE,
          StationId.of('station_1'),
          'refused',
          UserId.of('user_1'),
          RUN,
          new Date('2026-09-26T09:00:00Z'),
          CalledTool.of({ server: 'linear', tool: 'create_issue' }),
          true,
        ),
      ),
    ).toEqual([
      expect.objectContaining({
        act: 'refused',
        tool: 'create_issue',
        server: 'linear',
        forApproval: true,
      }),
    ]);
  });

  it('publishes the memories a run was briefed with, and never those the cap cut', () => {
    expect(
      published(
        new RunBriefed(
          RUN,
          WORKSPACE,
          BriefedMemories.of({
            briefed: [{ id: 'memory_1', handle: 'M-1' }],
            cut: [{ id: 'memory_2', handle: 'M-2' }],
          }),
        ),
      ),
    ).toEqual([
      {
        kind: 'work.run-briefed.v1',
        runId: 'run_1',
        workspaceId: 'ws_1',
        memories: ['memory_1'],
      },
    ]);
  });
});
