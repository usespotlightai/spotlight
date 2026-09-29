import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
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

const said = (body: string, voice: Voice) => ({
  station: StationName.of('build'),
  body: TaskNoteBody.of(body),
  at: NOW,
  voice,
});

const held = () =>
  Task.add({
    line,
    at: BUILD,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).handedTo(RUN, line);

const paused = () =>
  held().putToAPersonBy(
    RUN,
    said('Which queue should I drain?', Voice.station(RUN)),
  );

const answer = (task: Task) =>
  task.answered(
    NotePosition.of(0),
    said('The default one.', Voice.person(UserId.of('user_1'))),
  );

describe('a task put to a person by the run that holds it', () => {
  it('stays held by the run while it waits on the person', () => {
    const task = paused();

    expect(task.heldBy(RUN)).toBe(true);
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

  it('is put to a person only by the run holding it, and only once at a time', () => {
    expect(() =>
      held().putToAPersonBy(
        RunId.of('run_2'),
        said('Which?', Voice.station(RunId.of('run_2'))),
      ),
    ).toThrow(InvalidTaskTransitionError);
    expect(() =>
      paused().putToAPersonBy(RUN, said('And?', Voice.station(RUN))),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('wants no new run while its run waits, and none once answered', () => {
    expect(paused().wantsRun(line)).toBe(false);
    expect(answer(paused()).wantsRun(line)).toBe(false);
  });

  it('keeps the answer for the waiting run to be given', () => {
    const task = answer(paused());

    expect(task.working).toBe(true);
    expect(task.undelivered.map((each) => each.body.value)).toEqual([
      'The default one.',
    ]);
    expect(
      task.deliveredUpTo(NotePosition.of(1), NOW).undelivered,
    ).toHaveLength(0);
  });

  it('hands an answer to the next run’s briefing where no run holds the task', () => {
    const asked = held().askedAbout(
      said('Which queue should I drain?', Voice.station(RUN)),
      RUN,
    );

    expect(asked.running).toBe(false);
    expect(answer(asked).undelivered).toEqual([]);
    expect(answer(asked).wantsRun(line)).toBe(true);
  });

  it('can be put to a person again by the same run once answered', () => {
    const again = answer(paused()).putToAPersonBy(
      RUN,
      said('Ready for review.', Voice.station(RUN)),
    );

    expect(again.awaitingReview).toBe(true);
    expect(again.heldBy(RUN)).toBe(true);
    expect(again.openConversation?.from).toBe(0);
  });

  it('is let go by its run when that run ends while the person is still asked', () => {
    const task = paused().leftBy(RUN, NOW);

    expect(task.running).toBe(false);
    expect(task.awaitingReview).toBe(true);
    expect(paused().leftBy(RunId.of('run_2'), NOW).heldBy(RUN)).toBe(true);
  });

  it('takes a person speaking to the waiting run as their answer to its open question', () => {
    const spoken = paused().spokenTo(
      RUN,
      said('The default one.', Voice.person(UserId.of('user_1'))),
      BUILD,
    );

    expect(spoken.awaitingReview).toBe(false);
    expect(spoken.notes[1]?.kind).toBe('answered');
    expect(spoken.pullEvents()).toContainEqual(
      new TaskAnswered(spoken.id, spoken.workspaceId, RUN),
    );
  });

  it('takes words to a run waiting on an approval as something said, leaving the approval to be decided', () => {
    const approving = held().clearFor(
      ApprovalSubject.toolCall(
        ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
      ),
      ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
      said('Approve linear.comment?', Voice.station(RUN)),
      RUN,
    ).task;

    const spoken = approving.spokenTo(
      RUN,
      said('Why do you need it?', Voice.person(UserId.of('user_1'))),
      BUILD,
    );

    expect(approving.owesADecision).toBe(true);
    expect(spoken.awaitingReview).toBe(true);
    expect(spoken.notes[1]?.kind).toBe('said');
    expect(
      spoken.pullEvents().some((each) => each instanceof TaskAnswered),
    ).toBe(false);
  });

  it('takes a person speaking to a working run as something said to it, answering nothing', () => {
    const spoken = held().spokenTo(
      RUN,
      said('Use the staging queue.', Voice.person(UserId.of('user_1'))),
      BUILD,
    );

    expect(spoken.notes[0]?.kind).toBe('said');
    expect(
      spoken.pullEvents().some((each) => each instanceof TaskAnswered),
    ).toBe(false);
  });

  it('says it was answered for the run holding it, so that run is taken up', () => {
    const task = answer(paused());

    expect(task.pullEvents()).toContainEqual(
      new TaskAnswered(task.id, task.workspaceId, RUN),
    );
    expect(task.takesUp(RUN)).toBe(true);
    expect(paused().takesUp(RUN)).toBe(false);
  });

  it('hands an answer its run never heard on to the next run’s briefing once it lets go', () => {
    const answered = answer(paused());

    expect(answered.leftBy(RUN, NOW).undelivered).toEqual([]);
    expect(
      answered.moveTo(
        line,
        StationId.of('station_backlog'),
        TaskRank.of('j'),
        said('Moved on.', Voice.person(UserId.of('user_1'))),
        { mover: UserId.of('user_1') },
      ).undelivered,
    ).toEqual([]);
    expect(
      answered.askedAbout(said('Stopped.', Voice.station(RUN)), RUN)
        .undelivered,
    ).toEqual([]);
  });

  it('lets go of its waiting run when a person parks it in the backlog, so the run ends', () => {
    const task = paused();
    task.pullEvents();

    const moved = task.moveTo(
      line,
      StationId.of('station_backlog'),
      TaskRank.of('j'),
      said('Moved on.', Voice.person(UserId.of('user_1'))),
      { mover: UserId.of('user_1') },
    );

    expect(moved.running).toBe(false);
    expect(moved.pullEvents()).toContainEqual(
      new TaskLetGoOfRun(moved.id, moved.workspaceId, RUN),
    );
  });
});
