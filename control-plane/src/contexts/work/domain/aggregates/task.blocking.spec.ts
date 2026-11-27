import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { itemAt } from '@shared-kernel/domain/item-at';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskBlockersChanged } from '@work/domain/events/task-blockers-changed.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { InvalidTaskBlockerError } from '@work/domain/exceptions/invalid-task-blocker.error';
import { TaskBlockedError } from '@work/domain/exceptions/task-blocked.error';
import { TaskBlockingCycleError } from '@work/domain/exceptions/task-blocking-cycle.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { Blocking } from '@work/domain/services/blocking';
import { BlockingGraph } from '@work/domain/services/blocking-graph';
import { ReactionFor } from '@work/domain/services/reaction-for';
import {
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T09:00:00.000Z');
const LEON = UserId.of('user_leon');
const BACKLOG = StationId.of('station_backlog');
const TRIAGE = StationId.of('station_triage');
const SPEC = StationId.of('station_spec');
const DONE = StationId.of('station_completed');

const station = (
  id: StationId,
  name: string,
  position: number,
  over: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id,
    key: StationKey.of(id.value.replace('station_', '')),
    name: StationName.of(name),
    position,
    color: '#a3a8b0',
    ...over,
  });

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station(BACKLOG, 'Backlog', 0, { kind: 'backlog' }),
    station(TRIAGE, 'Triage', 1, {
      harness: HarnessId.of('dev'),
      routes: routesOf({ stations: [SPEC], ends: true }),
    }),
    station(SPEC, 'Spec', 2, { harness: HarnessId.of('dev') }),
    station(DONE, 'Completed', 3, { kind: 'completed' }),
  ],
});

const lineIn = (workspaceId: string | undefined) =>
  workspaceId === undefined
    ? LINE
    : lineMapOf({
        id: LineId.of('line_2'),
        workspaceId: WorkspaceId.of(workspaceId),
        teamId: TeamId.of('team_2'),
        key: LineKey.of('other'),
        name: LineName.of('Other'),
        stations: LINE.stations,
      });

const opened = (
  id: string,
  input: {
    at?: StationId;
    blockedBy?: readonly Task[];
    workspaceId?: string;
  } = {},
) => {
  const line = lineIn(input.workspaceId);

  return Task.add({
    line,
    at: input.at ?? BACKLOG,
    title: TaskTitle.of(`Web ${id}`),
    rank: TaskRank.of('i'),
    createdBy: LEON,
    blockedBy: Blocking.forNewTask(line.workspaceId, input.blockedBy ?? []),
    now: NOW,
    newId: () => id,
  });
};

const completed = (task: Task) =>
  task.moveTo(
    LINE,
    DONE,
    TaskRank.of('i'),
    {
      line: LINE,
      body: TaskNoteBody.of('Done.'),
      at: NOW,
      voice: Voice.station(),
    },
    { mover: LEON },
  );

const noteOf = (titles: readonly Task[]) => ({
  line: LINE,
  body: TaskNoteBody.blockedBy(titles.map((each) => each.title)),
  at: NOW,
  voice: Voice.station(),
});

const blockedBy = (
  task: Task,
  blockers: readonly Task[],
  graph = BlockingGraph.empty(),
) =>
  task.blockBy(
    LINE,
    Blocking.forTask(task, blockers, graph),
    LEON,
    noteOf(blockers),
  );

const graphOf = (...tasks: Task[]) =>
  BlockingGraph.of(
    tasks.map((each) => ({ task: each.id, blockedBy: each.blockedBy })),
  );

const lastNote = (task: Task) =>
  itemAt(task.notes, task.notes.length - 1)?.body.value;

const ids = (task: Task) => task.blockedBy.map((each) => each.value);

describe('Task blocked by other tasks', () => {
  it('opens in Backlog while it waits, even when asked for a work station', () => {
    const first = opened('task_1', { at: TRIAGE });
    const second = opened('task_2', { at: TRIAGE, blockedBy: [first] });

    expect(first.stationId).toEqual(TRIAGE);
    expect(second.stationId).toEqual(BACKLOG);
    expect(ids(second)).toEqual(['task_1']);
    expect(Task.opensAt(LINE, TRIAGE, [first.id])).toEqual(BACKLOG);
    expect(Task.opensAt(LINE, TRIAGE, [])).toEqual(TRIAGE);
  });

  it('is not blocked by a completed task', () => {
    const first = completed(opened('task_1'));
    const second = opened('task_2', { at: TRIAGE, blockedBy: [first] });

    expect(second.blocked).toBe(false);
    expect(second.stationId).toEqual(TRIAGE);
  });

  it('cannot be blocked by a task of another workspace', () => {
    const elsewhere = opened('task_9', { workspaceId: 'ws_2' });

    expect(() => opened('task_2', { blockedBy: [elsewhere] })).toThrow(
      UnknownTaskError,
    );
  });

  it('sets and clears its blockers while in Backlog, says so in its trail, and names who did', () => {
    const first = opened('task_1');
    const second = opened('task_2');
    second.pullEvents();

    const blocked = blockedBy(second, [first]);

    expect(ids(blocked)).toEqual(['task_1']);
    expect(lastNote(blocked)).toBe(
      'Blocked by Web task_1. It waits in Backlog and starts when they are completed.',
    );
    expect(blocked.pullEvents()).toContainEqual(
      new TaskBlockersChanged(second.id, second.workspaceId, [first.id], LEON),
    );

    const cleared = blockedBy(blocked, []);

    expect(cleared.blocked).toBe(false);
    expect(lastNote(cleared)).toBe('No longer blocked by other tasks.');
    expect(blockedBy(cleared, [])).toBe(cleared);
  });

  it('refuses to wait for itself', () => {
    const task = opened('task_1');

    expect(() => blockedBy(task, [task])).toThrow(InvalidTaskBlockerError);
    expect(() => task.blockBy(LINE, [task.id], LEON, noteOf([task]))).toThrow(
      InvalidTaskBlockerError,
    );
  });

  it('refuses a cycle, also through other tasks', () => {
    const first = opened('task_1');
    const second = opened('task_2', { blockedBy: [first] });
    const third = opened('task_3', { blockedBy: [second] });

    expect(() =>
      blockedBy(first, [third], graphOf(first, second, third)),
    ).toThrow(TaskBlockingCycleError);
    expect(() =>
      blockedBy(first, [second], graphOf(first, second, third)),
    ).toThrow(TaskBlockingCycleError);
  });

  it('cannot start waiting once it has left Backlog', () => {
    const first = opened('task_1');
    const started = opened('task_2', { at: TRIAGE });

    expect(() => blockedBy(started, [first])).toThrow(TaskBlockedError);
    expect(blockedBy(started, [])).toBe(started);
  });

  it('cannot be started by hand, but can still be completed', () => {
    const first = opened('task_1');
    const second = opened('task_2', { blockedBy: [first] });
    const note = {
      line: LINE,
      body: TaskNoteBody.of('Moved.'),
      at: NOW,
      voice: Voice.station(),
    };

    expect(second.wantsRun(LINE)).toBe(false);
    expect(() =>
      second.moveTo(LINE, TRIAGE, TaskRank.of('i'), note, { mover: LEON }),
    ).toThrow(TaskBlockedError);

    const done = completed(second);

    expect(done.finished).toBe(true);
    expect(done.blocked).toBe(false);
  });

  it('stays in Backlog when an event would move it to a work station', () => {
    const second = opened('task_2', { blockedBy: [opened('task_1')] });
    const triage = LINE.stationAt(TRIAGE);

    if (!triage) {
      throw new Error('no triage');
    }

    expect(
      ReactionFor.movingTo(
        second,
        triage,
        { line: LINE, body: TaskNoteBody.of('Checks failed.'), anchor: null },
        null,
      ).kind,
    ).toBe('stays');
  });

  it('moves to the first station of its line when the last task it waits for is completed', () => {
    const first = opened('task_1');
    const other = opened('task_3');
    const second = opened('task_2', { blockedBy: [first, other] });

    const halfway = second.blockerFinished(first.id, LINE, [], NOW);

    expect(halfway.stationId).toEqual(BACKLOG);
    expect(ids(halfway)).toEqual(['task_3']);

    halfway.pullEvents();
    const started = halfway.blockerFinished(
      other.id,
      LINE,
      [TaskRank.of('m')],
      NOW,
    );

    expect(Task.releasesTo(LINE)?.id).toEqual(TRIAGE);
    expect(started.stationId).toEqual(TRIAGE);
    expect(started.rank.value > 'm').toBe(true);
    expect(started.blocked).toBe(false);
    expect(started.wantsRun(LINE)).toBe(true);
    expect(lastNote(started)).toBe(
      'Moved to Triage. Every task it waited for is completed.',
    );
    expect(started.pullEvents().some((each) => each instanceof TaskMoved)).toBe(
      true,
    );
  });

  it('stays where it is when its line has no station where an agent works', () => {
    const bare = lineMapOf({
      id: LineId.of('line_bare'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('bare'),
      name: LineName.of('Bare'),
      stations: LINE.stations.filter((each) => !each.isAgentStation),
    });
    const first = opened('task_1');
    const second = opened('task_2', { blockedBy: [first] });

    const released = second.blockerFinished(first.id, bare, [], NOW);

    expect(released.blocked).toBe(false);
    expect(released.stationId).toEqual(BACKLOG);
  });

  it('ignores a completed task it does not wait for', () => {
    const second = opened('task_2');

    expect(second.blockerFinished(TaskId.of('task_1'), LINE, [], NOW)).toBe(
      second,
    );
  });

  it('stops waiting for a deleted task, and stays in Backlog for a person to move on', () => {
    const first = opened('task_1');
    const second = opened('task_2', { blockedBy: [first] });

    const released = second.blockerDeleted(first.id, LINE, NOW);

    expect(released.blocked).toBe(false);
    expect(released.stationId).toEqual(BACKLOG);
    expect(lastNote(released)).toContain('A task it waited for was deleted.');
    expect(released.blockerDeleted(first.id, LINE, NOW)).toBe(released);
  });

  it('is never stored waiting for itself, twice for one task, or while it runs or is finished', () => {
    const first = opened('task_1');
    const second = opened('task_2', { blockedBy: [first] });
    const stored = {
      ...second,
      revision: second.revision,
      version: second.version,
      finishedAt: null,
    };

    expect(() => Task.rehydrate({ ...stored, blockedBy: [second.id] })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      Task.rehydrate({ ...stored, blockedBy: [first.id, first.id] }),
    ).toThrow(InconsistentStateError);
    expect(() => Task.rehydrate({ ...stored, finishedAt: NOW })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      Task.rehydrate({ ...stored, currentRunId: RunId.of('run_1') }),
    ).toThrow(InconsistentStateError);
  });
});

describe('BlockingGraph', () => {
  it('follows waits through other tasks, and stops at a loop', () => {
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((each) => TaskId.of(each));
    const graph = BlockingGraph.of([
      { task: a, blockedBy: [b] },
      { task: b, blockedBy: [c, a] },
    ]);

    expect(graph.waitsFor(a, c)).toBe(true);
    expect(graph.waitsFor(c, a)).toBe(false);
    expect(graph.waitsFor(a, d)).toBe(false);
  });
});
