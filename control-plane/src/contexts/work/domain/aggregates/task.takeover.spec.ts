import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskHandedBack } from '@work/domain/events/task-handed-back.event';
import { TaskTakenOver } from '@work/domain/events/task-taken-over.event';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { NotATeamMemberError } from '@work/domain/exceptions/not-a-team-member.error';
import { TaskTakenOverError } from '@work/domain/exceptions/task-taken-over.error';
import { CheckoutHead } from '@work/domain/value-objects/checkout-head.vo';
import {
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TakeoverId } from '@work/domain/value-objects/takeover-id.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-16T09:00:00.000Z');
const LATER = new Date('2026-11-16T10:00:00.000Z');
const LINE_RUN = RunId.of('run_line');
const TURN = RunId.of('run_turn_1');
const LEON = UserId.of('user_leon');
const MAYA = UserId.of('user_maya');
const BACKLOG = StationId.of('station_backlog');
const BUILD = StationId.of('station_build');
const REVIEW = StationId.of('station_check');
const SHIP = StationId.of('station_ship');
const COMPLETED = StationId.of('station_completed');

const station = (
  id: StationId,
  key: string,
  position: number,
  extra: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id,
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: '#a3a8b0',
    ...extra,
  });

const line = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station(BACKLOG, 'backlog', 0, { kind: 'backlog' }),
    station(BUILD, 'build', 1, {
      harness: HarnessId.of('dev'),
      routes: routesOf({ stations: [REVIEW], ends: true }),
    }),
    station(REVIEW, 'check', 2, { harness: HarnessId.of('dev') }),
    station(SHIP, 'ship', 3, { harness: HarnessId.of('dev') }),
    station(COMPLETED, 'completed', 4, { kind: 'completed' }),
  ],
});

const at = (stationId: StationId) =>
  Task.add({
    line,
    at: stationId,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: LEON,
    now: NOW,
    newId: () => 'task_1',
  });

const running = () => at(BUILD).assignRun(LINE_RUN, line);

const TEAM = TeamMembers.of([LEON, MAYA]);

const takenOver = (task: Task = running(), by: UserId = LEON) =>
  task.takeOver({
    id: TakeoverId.of('takeover_1'),
    by,
    members: TEAM,
    line,
    verdict: 'not-right',
    currentRunStarted: true,
    at: NOW,
  });

const said = (body: string, voice: Voice) => ({
  line,
  body: TaskNoteBody.of(body),
  at: NOW,
  voice,
});

const driving = () =>
  takenOver()
    .addMessage(said('Use a bounded queue.', Voice.person(LEON)))
    .assignRun(TURN, line);

const driving2 = (task: Task) =>
  takenOver(task)
    .addMessage(said('Use a bounded queue.', Voice.person(LEON)))
    .assignRun(TURN, line);

const turnDone = (task: Task = driving()) =>
  task.putToAPerson(
    TURN,
    said('Done. The queue is bounded now.', Voice.station(TURN)),
  );

const head = (commit: string) =>
  CheckoutHead.of({ path: '/workspace/app', commit: commit.repeat(40) });

const handedBack = (
  task: Task,
  next: 'continue' | 'move-on' | 'finish',
  to: StationId | null = null,
) =>
  task.handBack({
    by: LEON,
    line,
    next,
    to,
    rank: next === 'continue' ? null : TaskRank.of('m'),
    verdict: null,
    summary: 'Kept the queue bounded.',
    turnHeads: [
      TurnHeads.of({ runId: TURN, started: [head('a')], ended: [head('b')] }),
    ],
    at: LATER,
  });

const lastOf = (task: Task) => task.notes[task.notes.length - 1];

describe('a task a person takes over', () => {
  it('stops the line run and counts it as the run the person took over from', () => {
    const task = takenOver();

    expect(task.currentRunId).toBeNull();
    expect(task.openTakeover?.from?.equals(LINE_RUN)).toBe(true);
    expect(task.openTakeover?.by.equals(LEON)).toBe(true);
    expect(task.pullEvents()).toContainEqual(
      expect.objectContaining({
        kind: 'task.taken-over',
        verdict: 'not-right',
      }),
    );
  });

  it('leaves the agent its instructions in a note it reads on the next turn', () => {
    const note = lastOf(takenOver());

    expect(note?.form).toBe('took-over');
    expect(note?.unacknowledged).toBe(true);
    expect(note?.body.value).toContain('Commit your changes');
  });

  it('starts no run until the person who took it over says something', () => {
    const task = takenOver();

    expect(task.wantsRun(line)).toBe(false);
    expect(
      task
        .addMessage(said('Try this instead.', Voice.person(MAYA)))
        .wantsRun(line),
    ).toBe(false);
    expect(
      task
        .addMessage(said('Use a bounded queue.', Voice.person(LEON)))
        .wantsRun(line),
    ).toBe(true);
  });

  it('counts each run it then starts as a turn driven by the person', () => {
    const task = driving();

    expect(task.drivenByAPerson(TURN)).toBe(true);
    expect(task.drivenByAPerson(LINE_RUN)).toBe(false);
    expect(task.openTakeover?.turns.map((each) => each.value)).toEqual([
      'run_turn_1',
    ]);
  });

  it('cannot be taken over twice at once, and says who has it', () => {
    expect(() => takenOver(takenOver(), MAYA)).toThrow(TaskTakenOverError);
    expect(() => takenOver(takenOver(), MAYA)).toThrow(
      expect.objectContaining({ by: LEON }),
    );
  });

  it('cannot be taken over where no agent works', () => {
    expect(() => takenOver(at(BACKLOG))).toThrow(InvalidTaskTransitionError);
  });

  it('cannot be moved by hand or by a reaction while a person has it', () => {
    const task = takenOver();

    expect(() =>
      task.react(line, REVIEW, TaskRank.of('m'), said('Moved', Voice.world())),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('holds a reaction aside and moves after the next run when the person hands it back', () => {
    const held = takenOver().deferMove(
      line,
      SHIP,
      said('The pull request was approved.', Voice.world()),
    );

    expect(held.openTakeover?.heldMove?.equals(SHIP)).toBe(true);
    expect(lastOf(held)?.unacknowledged).toBe(false);

    const back = handedBack(held, 'continue');

    expect(back.stationId.equals(BUILD)).toBe(true);
    expect(lastOf(back)?.deferredMove?.to.equals(SHIP)).toBe(true);
  });

  it('lets only the person who took it over answer its turn', () => {
    const asked = turnDone();
    const members = TeamMembers.of([LEON, MAYA]);
    const fromMaya = asked.receiveMessage(
      TURN,
      said('Ship it as it is.', Voice.person(MAYA)),
      BUILD,
      members,
    );

    expect(fromMaya.pendingConversation).not.toBeNull();
    expect(lastOf(fromMaya)?.unacknowledged).toBe(false);
    expect(fromMaya.wantsRun(line)).toBe(false);

    const fromLeon = asked.receiveMessage(
      TURN,
      said('Now add a test.', Voice.person(LEON)),
      BUILD,
      members,
    );

    expect(fromLeon.pendingConversation).toBeNull();
  });

  it('holds aside what others say while a person has it', () => {
    const task = takenOver()
      .addMessage(said('Ship it as it is.', Voice.person(MAYA)))
      .addMessage(said('The checks passed.', Voice.world()));

    expect(task.notes.slice(-2).map((note) => note.unacknowledged)).toEqual([
      false,
      false,
    ]);
    expect(task.wantsRun(line)).toBe(false);
  });

  it('keeps a failure the line reports while a person has it, without a move', () => {
    const failed = driving().failed(
      TaskFailure.fromHook('ci', 'checks-failed'),
      said('The checks failed.', Voice.world()),
      null,
      line,
    );

    expect(failed.stationId.equals(BUILD)).toBe(true);
    expect(failed.takenOver).toBe(true);
  });
});

describe('a task a person drives', () => {
  const members = TeamMembers.of([LEON, MAYA]);

  it('is assigned to the person who took it over, and stays so', () => {
    const task = takenOver(running().assign(MAYA, members));

    expect(task.assignee?.equals(LEON)).toBe(true);
    expect(() => task.assign(MAYA, members)).toThrow(
      InvalidTaskTransitionError,
    );
    expect(() => task.unassign()).toThrow(InvalidTaskTransitionError);
  });

  it('takes answers to its turns from the person who took it over only', () => {
    const asked = turnDone(driving2(running().assign(MAYA, members)));
    const from = asked.pendingConversation?.from;

    expect(from).toBeDefined();

    if (!from) {
      return;
    }

    expect(() =>
      asked.answer(from, said('Ship it.', Voice.person(MAYA))),
    ).toThrow('Only they can answer it');
    expect(() =>
      asked.resolveAt(from, said('Done.', Voice.person(MAYA))),
    ).toThrow('Only they can resolve it');
    expect(
      asked.receiveMessage(
        TURN,
        said('Now add a test.', Voice.person(LEON)),
        BUILD,
        members,
      ).pendingConversation,
    ).toBeNull();
  });

  it('starts the next turn when the person answers a turn that failed', () => {
    const failed = driving().failed(
      TaskFailure.fromHook('ci', 'checks-failed'),
      said('The agent crashed.', Voice.world()),
      TURN,
      line,
    );
    const answered = failed.receiveMessage(
      TURN,
      said('Try again, smaller.', Voice.person(LEON)),
      BUILD,
      members,
    );

    expect(answered.wantsRun(line)).toBe(true);
  });

  it('puts what its turns answer or fail to the person, as turns they drove', () => {
    const asked = turnDone();
    const failed = driving().failed(
      TaskFailure.fromHook('ci', 'checks-failed'),
      said('The agent crashed.', Voice.world()),
      TURN,
      line,
    );
    const askedOf = asked
      .pullEvents()
      .find((each): each is TaskAsked => each instanceof TaskAsked);
    const failedOf = failed
      .pullEvents()
      .find((each): each is TaskFailed => each instanceof TaskFailed);

    expect(askedOf?.assignee).toEqual(LEON);
    expect(askedOf?.driver).toBe('person');
    expect(failedOf?.driver).toBe('person');
    expect(asked.hasUnreadAsk).toBe(true);
    expect(failed.hasUnreadAsk).toBe(true);
  });

  it('tells the line nothing of what the person answers', () => {
    expect(
      turnDone()
        .receiveMessage(
          TURN,
          said('Now add a test.', Voice.person(LEON)),
          BUILD,
          members,
        )
        .pullEvents()
        .map((each) => each.kind),
    ).not.toContain('task.acted-on');
  });

  it('holds a move to the station it is at as a note only', () => {
    const held = takenOver().deferMove(
      line,
      BUILD,
      said('A review came in.', Voice.world()),
    );

    expect(held.openTakeover?.heldMove).toBeNull();
    expect(lastOf(held)?.body.value).toBe('A review came in.');
  });

  it('is not stored running a line run while a person has it', () => {
    const task = takenOver();

    expect(() => Task.rehydrate({ ...task, currentRunId: LINE_RUN })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      Task.rehydrate({
        ...task,
        takeovers: [...task.takeovers, ...task.takeovers],
      }),
    ).toThrow(InconsistentStateError);
    expect(() => Task.rehydrate({ ...task, stationId: REVIEW })).toThrow(
      InconsistentStateError,
    );
  });

  it('is taken over by a member of its team only', () => {
    expect(() =>
      running().takeOver({
        id: TakeoverId.of('takeover_1'),
        by: UserId.of('user_guest'),
        members: TEAM,
        line,
        verdict: null,
        currentRunStarted: true,
        at: NOW,
      }),
    ).toThrow(NotATeamMemberError);
  });

  it('is not stored taken over after it finished, or assigned to someone else', () => {
    const task = takenOver();

    expect(() => Task.rehydrate({ ...task, finishedAt: LATER })).toThrow(
      InconsistentStateError,
    );
    expect(() => Task.rehydrate({ ...task, assignee: MAYA })).toThrow(
      InconsistentStateError,
    );
    expect(() => Task.rehydrate({ ...task, takeovers: [] })).toThrow(
      InconsistentStateError,
    );
  });

  it('is reopened only by the person who took it over', () => {
    const asked = turnDone();
    const from = asked.pendingConversation?.from;

    expect(from).toBeDefined();

    if (!from) {
      return;
    }

    const resolved = asked.resolveAt(from, said('Done.', Voice.person(LEON)));

    expect(() =>
      resolved.reopenAt(from, said('Not yet.', Voice.person(MAYA))),
    ).toThrow('Only they can reopen it');
  });

  it('holds a failure a hook reports, telling the line nothing', () => {
    const failed = driving().failed(
      TaskFailure.fromHook('ci', 'checks-failed'),
      said('The checks failed.', Voice.world()),
      null,
      line,
    );

    expect(failed.pullEvents().map((each) => each.kind)).not.toContain(
      'task.failed',
    );
    expect(lastOf(failed)?.unacknowledged).toBe(false);
  });

  it('briefs its turns without what was held aside', () => {
    const task = driving().addMessage(
      said('The checks failed.', Voice.world()),
    );

    expect(task.briefedOn(line).notes.map((note) => note.body)).not.toContain(
      'The checks failed.',
    );
  });

  it('is not finished by a run while a person has it', () => {
    expect(() =>
      driving().finishHere(TURN, line, said('Done.', Voice.station(TURN))),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('cannot be taken over once it has finished', () => {
    const finished = handedBack(turnDone(), 'finish');

    expect(() => takenOver(finished)).toThrow('has finished');
  });
});

describe('a task a person hands back to the line', () => {
  it('ends the takeover and lets the station agent go on from the changes', () => {
    const back = handedBack(turnDone(), 'continue');

    expect(back.takenOver).toBe(false);
    expect(back.stationId.equals(BUILD)).toBe(true);
    expect(back.wantsRun(line)).toBe(true);
    expect(lastOf(back)?.form).toBe('handed-back');
    expect(lastOf(back)?.body.value).toContain(
      `git -C /workspace/app diff ${'a'.repeat(40)}..${'b'.repeat(40)}`,
    );
  });

  it('records the turns, the commits and how the takeover ended', () => {
    const back = handedBack(turnDone(), 'continue');
    const event = back
      .pullEvents()
      .find((each): each is TaskHandedBack => each instanceof TaskHandedBack);

    expect(event?.handBack).toBe('continue');
    expect(event?.turns.map((each) => each.value)).toEqual(['run_turn_1']);
    expect(event?.from?.equals(LINE_RUN)).toBe(true);
    expect(event?.toHeads.map((each) => each.commit)).toEqual(['b'.repeat(40)]);
  });

  it('counts against the line run it was taken from when the line got it wrong', () => {
    const acted = (task: Task) =>
      task
        .pullEvents()
        .filter((each): each is TaskActedOn => each instanceof TaskActedOn)
        .map((each) => ({
          action: each.action,
          after: each.after?.value ?? null,
          at: each.at,
        }));

    expect(acted(handedBack(turnDone(), 'continue'))).toEqual([
      { action: 'taken-over', after: 'run_line', at: NOW },
    ]);
    expect(
      acted(
        turnDone().handBack({
          by: LEON,
          line,
          next: 'continue',
          to: null,
          rank: null,
          verdict: 'exploring',
          summary: null,
          turnHeads: [],
          at: LATER,
        }),
      ),
    ).toEqual([]);
  });

  it('cannot be handed back while a turn is in progress', () => {
    expect(() => handedBack(driving(), 'continue')).toThrow(
      'Task task_1 has a turn in progress.',
    );
  });

  it('says when the person moved it elsewhere than an event asked', () => {
    const held = turnDone().deferMove(
      line,
      SHIP,
      said('The pull request was approved.', Voice.world()),
    );
    const back = handedBack(held, 'move-on', REVIEW);

    expect(back.stationId.equals(REVIEW)).toBe(true);
    expect(lastOf(back)?.body.value).toContain(
      'An event asked to move the task to ship while the person had it.',
    );
  });

  it('finishes when an event asked to finish it while a person had it', () => {
    const held = turnDone().deferMove(
      line,
      COMPLETED,
      said('The pull request was merged.', Voice.world()),
    );

    expect(held.handBackDestination(line, 'continue', null)?.id).toEqual(
      COMPLETED,
    );

    const back = held.handBack({
      by: LEON,
      line,
      next: 'continue',
      to: null,
      rank: TaskRank.of('m'),
      verdict: null,
      summary: null,
      turnHeads: [],
      at: LATER,
    });

    expect(back.finished).toBe(true);
    expect(lastOf(back)?.body.value).toContain(
      'An event asked for this move while the person had the task.',
    );
  });

  it('says on its note where the task went and what the person wrote', () => {
    const outcome = (task: Task) => {
      const handed = task.notes.find((each) => each.form === 'handed-back');

      return handed?.handedBack
        ? {
            next: handed.handedBack.next,
            station: handed.handedBack.station.value,
            summary: handed.handedBack.summary,
          }
        : null;
    };

    expect(outcome(handedBack(turnDone(), 'continue'))).toEqual({
      next: 'continue',
      station: 'build',
      summary: 'Kept the queue bounded.',
    });
    expect(outcome(handedBack(turnDone(), 'move-on', REVIEW))).toEqual({
      next: 'move-on',
      station: 'check',
      summary: 'Kept the queue bounded.',
    });
    expect(outcome(handedBack(turnDone(), 'finish'))).toEqual({
      next: 'finish',
      station: 'completed',
      summary: 'Kept the queue bounded.',
    });
  });

  it('says it is completed when it continued into a finish an event asked for', () => {
    const back = turnDone()
      .deferMove(
        line,
        COMPLETED,
        said('The pull request was merged.', Voice.world()),
      )
      .handBack({
        by: LEON,
        line,
        next: 'continue',
        to: null,
        rank: TaskRank.of('m'),
        verdict: null,
        summary: '  ',
        turnHeads: [],
        at: LATER,
      });
    const handed = back.notes.find((each) => each.form === 'handed-back');

    expect(handed?.handedBack?.next).toBe('finish');
    expect(handed?.handedBack?.summary).toBeNull();
  });

  it('is not stored with a hand-back note that says nothing of how it went', () => {
    const back = handedBack(turnDone(), 'continue');

    expect(() =>
      Task.rehydrate({
        ...back,
        notes: back.notes.map((each) =>
          each.form === 'handed-back'
            ? TaskNote.of({ ...each, handedBack: null })
            : each,
        ),
      }),
    ).toThrow(InconsistentStateError);
  });

  it('does not count against a line run twice', () => {
    const answered = running().putToAPerson(
      LINE_RUN,
      said('Done.', Voice.station(LINE_RUN)),
    );
    const once = handedBack(turnDone(driving2(answered)), 'continue');

    expect(takenOver(once, MAYA).openTakeover?.from).toBeNull();
  });

  it('takes over from no run of a station it has left', () => {
    const answered = running().putToAPerson(
      LINE_RUN,
      said('Done.', Voice.station(LINE_RUN)),
    );
    const exploring = answered
      .takeOver({
        id: TakeoverId.of('takeover_0'),
        by: LEON,
        members: TEAM,
        line,
        verdict: 'exploring',
        currentRunStarted: true,
        at: NOW,
      })
      .addMessage(said('Try a ring buffer.', Voice.person(LEON)))
      .assignRun(TURN, line);
    const moved = handedBack(turnDone(exploring), 'move-on', REVIEW);

    expect(moved.stationId.equals(REVIEW)).toBe(true);
    expect(takenOver(moved, MAYA).openTakeover?.from).toBeNull();
    expect(
      takenOver(
        handedBack(turnDone(exploring), 'continue'),
        MAYA,
      ).openTakeover?.from?.equals(LINE_RUN),
    ).toBe(true);
  });

  it('gives the line what arrived while the person had it', () => {
    const withCheck = driving().addMessage(
      said('The checks failed.', Voice.world()),
    );
    const check = lastOf(withCheck)?.position;

    expect(lastOf(withCheck)?.unacknowledged).toBe(false);

    const back = handedBack(turnDone(withCheck), 'continue');

    expect(
      back.notes.find((note) => check && note.position.equals(check))
        ?.unacknowledged,
    ).toBe(true);
  });

  it('does not count against an older line run when the last one already counted', () => {
    const first = RunId.of('run_line_0');
    const waiting = at(BUILD)
      .assignRun(first, line)
      .putToAPerson(first, said('Which queue?', Voice.station(first)))
      .leaveRun(first, NOW);
    const from = waiting.pendingConversation?.from;

    expect(from).toBeDefined();

    if (!from) {
      return;
    }

    const second = waiting
      .answer(from, said('The retry queue.', Voice.person(LEON)))
      .assignRun(LINE_RUN, line);
    const back = handedBack(turnDone(driving2(second)), 'continue');

    expect(takenOver(back, MAYA).openTakeover?.from).toBeNull();
  });

  it('is handed back only by the person who took it over', () => {
    expect(() =>
      turnDone().handBack({
        by: MAYA,
        line,
        next: 'continue',
        to: null,
        rank: null,
        verdict: 'exploring',
        summary: null,
        turnHeads: [],
        at: LATER,
      }),
    ).toThrow(TaskTakenOverError);
  });

  it('keeps what arrived while the person had it away from the next station', () => {
    const withCheck = driving().addMessage(
      said('The checks failed.', Voice.world()),
    );
    const check = lastOf(withCheck)?.position;
    const unacknowledged = (task: Task) =>
      task.notes.find((note) => check && note.position.equals(check))
        ?.unacknowledged;

    expect(
      unacknowledged(handedBack(turnDone(withCheck), 'move-on', REVIEW)),
    ).toBe(false);
    expect(unacknowledged(handedBack(turnDone(withCheck), 'finish'))).toBe(
      false,
    );
  });

  it('leaves the line no instructions meant for the person’s turns when no turn ran', () => {
    const back = handedBack(takenOver(), 'continue');
    const tookOver = back.notes.find((note) => note.form === 'took-over');

    expect(tookOver?.unacknowledged).toBe(false);
  });

  it('credits a later hand move to the line run, never to a turn', () => {
    const back = handedBack(turnDone(), 'continue');

    back.pullEvents();
    const acted = back
      .moveTo(
        line,
        BACKLOG,
        TaskRank.of('m'),
        said('Not now.', Voice.person(LEON)),
        { mover: LEON },
      )
      .pullEvents()
      .filter((each): each is TaskActedOn => each instanceof TaskActedOn);

    expect(acted.map((each) => each.after?.value ?? null)).toEqual([null]);
  });

  it('needs a station and a place to move on to', () => {
    expect(() => handedBack(turnDone(), 'move-on', null)).toThrow(
      'needs a station to move on to',
    );
    expect(() =>
      turnDone().handBack({
        by: LEON,
        line,
        next: 'move-on',
        to: REVIEW,
        rank: null,
        verdict: null,
        summary: null,
        turnHeads: [],
        at: LATER,
      }),
    ).toThrow('needs a place at the station it moves to');
  });

  it('moves on to a station its station passes work to', () => {
    const back = handedBack(turnDone(), 'move-on', REVIEW);

    expect(back.stationId.equals(REVIEW)).toBe(true);
  });

  it('does not move on to a station its station does not pass work to', () => {
    expect(() => handedBack(turnDone(), 'move-on', SHIP)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('finishes at the end of its line', () => {
    const back = handedBack(turnDone(), 'finish');

    expect(back.stationId.equals(COMPLETED)).toBe(true);
    expect(back.finished).toBe(true);
  });

  it('cannot be handed back when nobody has it', () => {
    expect(() => handedBack(running(), 'continue')).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('takes over from the next line run after a hand-back, not from a turn', () => {
    const lineAgain = RunId.of('run_line_2');
    const back = handedBack(turnDone(), 'continue');

    expect(takenOver(back, MAYA).openTakeover?.from).toBeNull();
    expect(
      takenOver(
        back.assignRun(lineAgain, line),
        MAYA,
      ).openTakeover?.from?.equals(lineAgain),
    ).toBe(true);
  });

  it('says who took it over and from which run', () => {
    const event = takenOver()
      .pullEvents()
      .find((each): each is TaskTakenOver => each instanceof TaskTakenOver);

    expect(event?.by.equals(LEON)).toBe(true);
    expect(event?.from?.equals(LINE_RUN)).toBe(true);
  });
});
