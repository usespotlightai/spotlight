import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WORK_PUBLICATIONS } from '@work/application/integration-events/work.publications';
import { RunAbandoned } from '@work/domain/events/run-abandoned.event';
import { RunBriefed } from '@work/domain/events/run-briefed.event';
import { RunCompleted } from '@work/domain/events/run-completed.event';
import { RunSuperseded } from '@work/domain/events/run-superseded.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { TaskOpened } from '@work/domain/events/task-opened.event';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  WORK_PUBLICATIONS.filter((each) => each.from === event.kind).map((each) =>
    each.publish(event),
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
  it('publishes a task opening', () => {
    expect(
      published(
        new TaskOpened(TASK, WORKSPACE, StationId.of('station_1'), false),
      ),
    ).toEqual([
      { kind: 'work.task-opened.v1', taskId: 'task_1', workspaceId: 'ws_1' },
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

  it('publishes what a person did to a task, and after which run', () => {
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
        after: 'run_1',
        at: '2026-09-26T09:00:00.000Z',
      },
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
