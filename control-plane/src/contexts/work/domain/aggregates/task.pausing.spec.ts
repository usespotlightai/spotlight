import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { RunDetached } from '@work/domain/events/run-detached.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
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

const NOW = new Date('2026-09-29T09:00:00.000Z');
const RUN = RunId.of('run_1');
const BUILD = StationId.of('station_build');
const SHIP = StationId.of('station_ship');

const station = (
  id: StationId,
  key: string,
  position: number,
  extra: Partial<Parameters<typeof Station.of>[0]> = {},
) =>
  Station.of({
    id,
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: StationColor.plain(),
    ...extra,
  });

const line = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station(StationId.of('station_backlog'), 'backlog', 0, {
      kind: 'backlog',
    }),
    station(BUILD, 'build', 1, { harness: HarnessId.of('dev') }),
    station(SHIP, 'ship', 2, { harness: HarnessId.of('dev') }),
    station(StationId.of('station_completed'), 'completed', 3, {
      kind: 'completed',
    }),
  ],
});

const newNote = (body: string, voice: Voice) => ({
  station: StationName.of('build'),
  body: TaskNoteBody.of(body),
  at: NOW,
  voice,
});

const assigned = () =>
  Task.add({
    line,
    at: BUILD,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).assignRun(RUN, line);

const paused = () =>
  assigned().putToAPerson(
    RUN,
    newNote('Which queue should I drain?', Voice.station(RUN)),
  );

const answer = (task: Task) =>
  task.answer(
    NotePosition.of(0),
    newNote('The default one.', Voice.person(UserId.of('user_1'))),
  );

describe('a task put to a person by its current run', () => {
  it('keeps its current run while it waits on the person', () => {
    const task = paused();

    expect(task.hasCurrentRun(RUN)).toBe(true);
    expect(task.awaitingReview).toBe(true);
    expect(task.working).toBe(false);
    expect(task.idle).toBe(false);
  });

  it('asks its assignee, like any question', () => {
    const task = paused();

    expect(task.assignee?.value).toBe('user_1');
    expect(task.pullEvents().some((each) => each instanceof TaskAsked)).toBe(
      true,
    );
  });

  it('is put to a person only by its current run, and only once at a time', () => {
    expect(() =>
      assigned().putToAPerson(
        RunId.of('run_2'),
        newNote('Which?', Voice.station(RunId.of('run_2'))),
      ),
    ).toThrow(InvalidTaskTransitionError);
    expect(() =>
      paused().putToAPerson(RUN, newNote('And?', Voice.station(RUN))),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('wants no new run while its run waits, and none once answered', () => {
    expect(paused().wantsRun(line)).toBe(false);
    expect(answer(paused()).wantsRun(line)).toBe(false);
  });

  it('keeps the answer for the waiting run to be given', () => {
    const task = answer(paused());

    expect(task.working).toBe(true);
    expect(task.unacknowledged.map((each) => each.body.value)).toEqual([
      'The default one.',
    ]);
    expect(
      task.acknowledgeUpTo(NotePosition.of(1), NOW).unacknowledged,
    ).toHaveLength(0);
  });

  it('hands an answer to the next run’s briefing where the task has no current run', () => {
    const asked = assigned().askedAbout(
      newNote('Which queue should I drain?', Voice.station(RUN)),
      RUN,
    );

    expect(asked.running).toBe(false);
    expect(answer(asked).unacknowledged).toEqual([]);
    expect(answer(asked).wantsRun(line)).toBe(true);
  });

  it('can be put to a person again by the same run once answered', () => {
    const again = answer(paused()).putToAPerson(
      RUN,
      newNote('Ready for review.', Voice.station(RUN)),
    );

    expect(again.awaitingReview).toBe(true);
    expect(again.hasCurrentRun(RUN)).toBe(true);
    expect(again.openConversation?.from).toBe(0);
  });

  it('is left by its run when that run ends while the person is still asked', () => {
    const task = paused().leaveRun(RUN, NOW);

    expect(task.running).toBe(false);
    expect(task.awaitingReview).toBe(true);
    expect(paused().leaveRun(RunId.of('run_2'), NOW).hasCurrentRun(RUN)).toBe(
      true,
    );
  });

  it('takes a message from a person to the waiting run as their answer to its open question', () => {
    const received = paused().receiveMessage(
      RUN,
      newNote('The default one.', Voice.person(UserId.of('user_1'))),
      BUILD,
    );

    expect(received.awaitingReview).toBe(false);
    expect(received.notes[1]?.kind).toBe('answered');
    expect(received.pullEvents()).toContainEqual(
      new TaskAnswered(received.id, received.workspaceId, RUN),
    );
  });

  it('takes words to a run waiting on an approval as a message, leaving the approval to be decided', () => {
    const approving = assigned().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
      ),
      ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
      newNote('Approve linear.comment?', Voice.station(RUN)),
      RUN,
      null,
    ).task;

    const received = approving.receiveMessage(
      RUN,
      newNote('Why do you need it?', Voice.person(UserId.of('user_1'))),
      BUILD,
    );

    expect(approving.decisionPending).toBe(true);
    expect(received.awaitingReview).toBe(true);
    expect(received.notes[1]?.kind).toBe('message');
    expect(
      received.pullEvents().some((each) => each instanceof TaskAnswered),
    ).toBe(false);
  });

  it('takes a message from a person to a working run as a message, answering nothing', () => {
    const received = assigned().receiveMessage(
      RUN,
      newNote('Use the staging queue.', Voice.person(UserId.of('user_1'))),
      BUILD,
    );

    expect(received.notes[0]?.kind).toBe('message');
    expect(
      received.pullEvents().some((each) => each instanceof TaskAnswered),
    ).toBe(false);
  });

  it('says it was answered for its current run, so that run is taken up', () => {
    const task = answer(paused());

    expect(task.pullEvents()).toContainEqual(
      new TaskAnswered(task.id, task.workspaceId, RUN),
    );
    expect(task.takesUp(RUN)).toBe(true);
    expect(paused().takesUp(RUN)).toBe(false);
  });

  it('passes an answer its run never heard to the next run’s briefing once it leaves its run', () => {
    const answered = answer(paused());

    expect(answered.leaveRun(RUN, NOW).unacknowledged).toEqual([]);
    expect(
      answered.moveTo(
        line,
        StationId.of('station_backlog'),
        TaskRank.of('j'),
        newNote('Moved on.', Voice.person(UserId.of('user_1'))),
        { mover: UserId.of('user_1') },
      ).unacknowledged,
    ).toEqual([]);
    expect(
      answered.askedAbout(newNote('Stopped.', Voice.station(RUN)), RUN)
        .unacknowledged,
    ).toEqual([]);
  });

  it('detaches its waiting run when a person parks it in the backlog, so the run ends', () => {
    const task = paused();
    task.pullEvents();

    const moved = task.moveTo(
      line,
      StationId.of('station_backlog'),
      TaskRank.of('j'),
      newNote('Moved on.', Voice.person(UserId.of('user_1'))),
      { mover: UserId.of('user_1') },
    );

    expect(moved.running).toBe(false);
    expect(moved.pullEvents()).toContainEqual(
      new RunDetached(moved.id, moved.workspaceId, RUN),
    );
  });
});
