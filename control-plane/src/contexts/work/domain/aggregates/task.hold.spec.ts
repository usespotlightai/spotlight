import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { CheckoutHead } from '@shared-kernel/domain/value-objects/checkout-head.vo';
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
import { LineResumed } from '@work/domain/events/line-resumed.event';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskHeld } from '@work/domain/events/task-held.event';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { NotATeamMemberError } from '@work/domain/exceptions/not-a-team-member.error';
import { NotOnTheTeamAskedError } from '@work/domain/exceptions/not-on-the-team-asked.error';
import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';
import {
  ConversationAudience,
  type ConversationViewer,
} from '@work/domain/services/conversation-audience';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import type { HoldVerdict } from '@work/domain/value-objects/hold-verdict';
import {
  lineMapOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { TurnHeads } from '@work/domain/value-objects/turn-heads.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const senderOf = (
  note: Parameters<Task['receiveMessage']>[1],
  team: TeamStanding,
): Parameters<Task['receiveMessage']>[3] => ({
  person: note.voice.author ?? UserId.of('user_nobody'),
  team,
});

const ACTING = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: true,
});

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

const said = (body: string, voice: Voice) => ({
  line,
  body: TaskNoteBody.of(body),
  at: NOW,
  voice,
});

const happenedOn = (task: Task, body: string): Task => {
  const reacted = task.reactTo(
    { kind: 'stays', line, body: TaskNoteBody.of(body), anchor: null },
    {
      at: NOW,
      voice: Voice.world(),
      attachments: [],
      ranksAtDestination: [],
      members: TEAM,
    },
  );

  if (!reacted) {
    throw new Error('the task did not react to the happening');
  }

  return reacted;
};

const sentBy = (task: Task, by: UserId, body: string): Task =>
  task.receiveMessage(null, said(body, Voice.person(by)), task.stationId, {
    person: by,
    team: ACTING,
  });

const heldBy = (
  task: Task,
  by: UserId,
  body: string,
  hold: HoldId = HoldId.of('hold_1'),
) =>
  task.heldOnMessage(
    null,
    { id: hold, members: TEAM, line, currentRunStarted: true, at: NOW },
    said(body, Voice.person(by)),
    task.stationId,
    { person: by, team: ACTING },
  );

const settled = (asked: Task): Task => {
  const from = asked.pendingConversation?.from;

  if (!from) {
    throw new Error('The task asks nothing.');
  }

  return asked.resolveAs(
    { person: LEON, team: ACTING },
    from,
    said('Thanks.', Voice.person(LEON)),
  );
};

const onHold = (task: Task = running(), by: UserId = LEON) =>
  heldBy(task, by, 'Use a bounded queue.');

const driving = () => onHold().assignRun(TURN, line);

const driving2 = (task: Task) => onHold(task).assignRun(TURN, line);

const turnDone = (task: Task = driving()) =>
  task.putToAPerson(
    TURN,
    said('Done. The queue is bounded now.', Voice.station(TURN)),
  );

const head = (commit: string) =>
  CheckoutHead.of({ path: '/workspace/app', commit: commit.repeat(40) });

const resumption = (
  task: Task,
  next: 'continue' | 'move-on' | 'finish',
  to: StationId | null = null,
  verdict: HoldVerdict | null = null,
) =>
  task.resumeLine({
    by: LEON,
    line,
    next,
    to,
    rank: next === 'continue' ? null : TaskRank.of('m'),
    verdict,
    summary: 'Kept the queue bounded.',
    turnHeads: [
      TurnHeads.of({ runId: TURN, started: [head('a')], ended: [head('b')] }),
    ],
    at: LATER,
  });

const lastOf = (task: Task) => task.notes[task.notes.length - 1];

const answers = (task: Task, viewer: ConversationViewer): boolean =>
  ConversationAudience.mayAnswer(viewer.team, task.conversantOf(viewer));

describe('a task a person puts on hold', () => {
  it('stops the line run and counts it as the run the person held it from', () => {
    const task = onHold();

    expect(task.currentRunId).toBeNull();
    expect(task.openHold?.from?.equals(LINE_RUN)).toBe(true);
    expect(task.openHold?.by.equals(LEON)).toBe(true);
  });

  it('leaves the agent its instructions in a note it reads on the next turn', () => {
    const note = onHold().notes.find((each) => each.form === 'held');

    expect(note?.form).toBe('held');
    expect(note?.unacknowledged).toBe(true);
    expect(note?.body.value).toContain('Commit your changes');
  });

  it('starts no run until a person says something', () => {
    const task = driving().leaveRun(TURN, LATER);

    expect(onHold().wantsRun(line)).toBe(true);
    expect(task.wantsRun(line)).toBe(false);
    expect(happenedOn(task, 'The checks passed.').wantsRun(line)).toBe(false);
    expect(sentBy(task, LEON, 'Use a bounded queue.').wantsRun(line)).toBe(
      true,
    );
    expect(sentBy(task, MAYA, 'Try this instead.').wantsRun(line)).toBe(true);
  });

  it('counts each run it then starts as a turn driven by the person', () => {
    const task = driving();

    expect(task.drivenByAPerson(TURN)).toBe(true);
    expect(task.drivenByAPerson(LINE_RUN)).toBe(false);
    expect(task.openHold?.turns.map((each) => each.value)).toEqual([
      'run_turn_1',
    ]);
  });

  it('cannot be put on hold twice at once, and says who holds it', () => {
    expect(() => onHold(onHold(), MAYA)).toThrow(InvalidTaskTransitionError);
    expect(onHold().openHold?.by).toEqual(LEON);
  });

  it('cannot be put on hold where no agent works', () => {
    expect(() => onHold(at(BACKLOG))).toThrow(InvalidTaskTransitionError);
  });

  it('cannot be moved by hand or by a reaction while it is on hold', () => {
    const task = onHold();

    expect(() =>
      task.react(line, REVIEW, TaskRank.of('m'), said('Moved', Voice.world())),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('holds a reaction aside and moves after the next run when the line resumes', () => {
    const held = onHold().deferMove(
      line,
      SHIP,
      said('The pull request was approved.', Voice.world()),
    );

    expect(held.openHold?.heldMove?.equals(SHIP)).toBe(true);
    expect(lastOf(held)?.unacknowledged).toBe(false);

    const back = resumption(held, 'continue');

    expect(back.stationId.equals(BUILD)).toBe(true);
    expect(lastOf(back)?.deferredMove?.to.equals(SHIP)).toBe(true);
  });

  it('lets any person answer its turn, and keeps its assignee', () => {
    const asked = turnDone();
    const fromMaya = asked.receiveMessage(
      TURN,
      said('Now add a test.', Voice.person(MAYA)),
      BUILD,
      senderOf(said('Now add a test.', Voice.person(MAYA)), ACTING),
    );

    expect(fromMaya.pendingConversation).toBeNull();
    expect(fromMaya.assignee?.equals(LEON)).toBe(true);
  });

  it('holds aside what the world says, and gives the agent what people say', () => {
    const task = sentBy(
      happenedOn(onHold(), 'The checks passed.'),
      MAYA,
      'Ship it as it is.',
    );

    expect(task.notes.slice(-2).map((note) => note.unacknowledged)).toEqual([
      false,
      true,
    ]);
  });

  it('keeps a failure the line reports while it is on hold, without a move', () => {
    const failed = driving().failed(
      TaskFailure.fromHook('ci', 'checks-failed'),
      said('The checks failed.', Voice.world()),
      null,
      line,
    );

    expect(failed.stationId.equals(BUILD)).toBe(true);
    expect(failed.onHold).toBe(true);
  });
});

describe('a task a person drives', () => {
  const members = TeamMembers.of([LEON, MAYA]);

  it('is assigned to the person who holds it, and stays so', () => {
    const task = onHold(running().assign(MAYA, members));

    expect(task.assignee?.equals(LEON)).toBe(true);
    expect(() => task.assign(MAYA, members)).toThrow(
      InvalidTaskTransitionError,
    );
    expect(() => task.unassign()).toThrow(InvalidTaskTransitionError);
  });

  it('lets every person who acts on the team act on its conversations, and nobody who only sees it', () => {
    const task = onHold(running().assign(MAYA, members));
    const viewer = (actsOnTasks: boolean) => ({
      person: MAYA,
      team: TeamStanding.of({
        seesTeam: true,
        actsOnTeam: actsOnTasks,
        memberOfTeam: actsOnTasks,
      }),
    });

    expect(task.conversantOf(viewer(true))).toEqual({
      standing: null,
      drives: true,
    });
    expect(answers(task, viewer(true))).toBe(true);
    expect(task.conversantOf(viewer(false)).drives).toBe(false);
    expect(answers(task, viewer(false))).toBe(false);
    expect(
      answers(task, {
        person: LEON,
        team: TeamStanding.of({
          seesTeam: true,
          actsOnTeam: true,
          memberOfTeam: true,
        }),
      }),
    ).toBe(true);
  });

  it('gives the running turn what two people send while it runs, in the order they sent it, and starts no other turn', () => {
    const both = driving()
      .receiveMessage(
        TURN,
        said('Drain the old queue first.', Voice.person(MAYA)),
        BUILD,
        senderOf(
          said('Drain the old queue first.', Voice.person(MAYA)),
          ACTING,
        ),
      )
      .receiveMessage(
        TURN,
        said('Keep the retry limit.', Voice.person(LEON)),
        BUILD,
        senderOf(said('Keep the retry limit.', Voice.person(LEON)), ACTING),
      );
    const fromPeople = (task: Task) =>
      task
        .pendingFor(TURN)
        .filter((note) => note.form === 'words' && note.voice.isPerson)
        .map((note) => [note.voice.author?.value, note.body.value]);

    expect(both.currentRunId).toEqual(TURN);
    expect(both.wantsRun(line)).toBe(false);
    expect(fromPeople(both)).toEqual([
      [LEON.value, 'Use a bounded queue.'],
      [MAYA.value, 'Drain the old queue first.'],
      [LEON.value, 'Keep the retry limit.'],
    ]);
    expect(both.assignee).toEqual(LEON);
  });

  it('takes answers to its turns from people only', () => {
    const asked = turnDone(driving2(running().assign(MAYA, members)));
    const from = asked.pendingConversation?.from;

    expect(from).toBeDefined();

    if (!from) {
      return;
    }

    expect(() =>
      asked.answerAs(
        { person: MAYA, team: ACTING },
        from,
        said('Ship it.', Voice.world()),
      ),
    ).toThrow(InvalidTaskTransitionError);
    expect(() =>
      asked.resolveAs(
        { person: MAYA, team: ACTING },
        from,
        said('Done.', Voice.world()),
      ),
    ).toThrow(InvalidTaskTransitionError);
    expect(
      asked.resolveAs(
        {
          person: MAYA,
          team: TeamStanding.of({
            seesTeam: true,
            actsOnTeam: true,
            memberOfTeam: true,
          }),
        },
        from,
        said('Done.', Voice.person(MAYA)),
      ).pendingConversation,
    ).toBeNull();
    expect(() =>
      asked.resolveAs(
        {
          person: MAYA,
          team: TeamStanding.of({
            seesTeam: true,
            actsOnTeam: false,
            memberOfTeam: false,
          }),
        },
        from,
        said('Done.', Voice.person(MAYA)),
      ),
    ).toThrow(TeamMembershipRequiredError);
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
      senderOf(said('Try again, smaller.', Voice.person(LEON)), ACTING),
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
          senderOf(said('Now add a test.', Voice.person(LEON)), ACTING),
        )
        .pullEvents()
        .map((each) => each.kind),
    ).not.toContain('task.acted-on');
  });

  it('holds a move to the station it is at as a note only', () => {
    const held = onHold().deferMove(
      line,
      BUILD,
      said('A review came in.', Voice.world()),
    );

    expect(held.openHold?.heldMove).toBeNull();
    expect(lastOf(held)?.body.value).toBe('A review came in.');
  });

  it('is not stored running a line run while it is on hold', () => {
    const task = onHold();

    expect(() => Task.rehydrate({ ...task, currentRunId: LINE_RUN })).toThrow(
      InconsistentStateError,
    );
    expect(() =>
      Task.rehydrate({
        ...task,
        holds: [...task.holds, ...task.holds],
      }),
    ).toThrow(InconsistentStateError);
    expect(() => Task.rehydrate({ ...task, stationId: REVIEW })).toThrow(
      InconsistentStateError,
    );
  });

  it('is put on hold by a member of its team only', () => {
    expect(() =>
      heldBy(running(), UserId.of('user_guest'), 'Use a bounded queue.'),
    ).toThrow(NotATeamMemberError);
  });

  it('is not stored on hold after it finished, or assigned to someone else', () => {
    const task = onHold();

    expect(() => Task.rehydrate({ ...task, finishedAt: LATER })).toThrow(
      InconsistentStateError,
    );
    expect(() => Task.rehydrate({ ...task, assignee: MAYA })).toThrow(
      InconsistentStateError,
    );
    expect(() => Task.rehydrate({ ...task, holds: [] })).toThrow(
      InconsistentStateError,
    );
  });

  it('is reopened by any person who drives it', () => {
    const asked = turnDone();
    const from = asked.pendingConversation?.from;

    expect(from).toBeDefined();

    if (!from) {
      return;
    }

    const resolved = asked.resolveAs(
      { person: LEON, team: ACTING },
      from,
      said('Done.', Voice.person(LEON)),
    );

    expect(
      resolved.reopenAs(
        { person: MAYA, team: ACTING },
        from,
        said('Not yet.', Voice.person(MAYA)),
      ).pendingConversation,
    ).not.toBeNull();
    expect(() =>
      resolved.reopenAs(
        { person: MAYA, team: ACTING },
        from,
        said('Not yet.', Voice.world()),
      ),
    ).toThrow(InvalidTaskTransitionError);
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
    const task = happenedOn(driving(), 'The checks failed.');

    expect(task.briefedOn(line).notes.map((note) => note.body)).not.toContain(
      'The checks failed.',
    );
  });

  it('is not finished by a run while it is on hold', () => {
    expect(() =>
      driving().finishHere(TURN, line, said('Done.', Voice.station(TURN))),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('cannot be put on hold once it has finished', () => {
    const finished = resumption(turnDone(), 'finish');

    expect(finished.finished).toBe(true);
    expect(() => onHold(finished)).toThrow(InvalidTaskTransitionError);
  });
});

describe('a task whose line resumes', () => {
  it('ends the hold and lets the station agent go on from the changes', () => {
    const back = resumption(turnDone(), 'continue');

    expect(back.onHold).toBe(false);
    expect(back.stationId.equals(BUILD)).toBe(true);
    expect(back.wantsRun(line)).toBe(true);
    expect(lastOf(back)?.form).toBe('resumed');
    expect(lastOf(back)?.body.value).toContain(
      `git -C /workspace/app diff ${'a'.repeat(40)}..${'b'.repeat(40)}`,
    );
  });

  it('records the turns, the commits and how the hold ended', () => {
    const back = resumption(turnDone(), 'continue');
    const event = back
      .pullEvents()
      .find((each): each is LineResumed => each instanceof LineResumed);

    expect(event?.end).toBe('continue');
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

    expect(acted(resumption(turnDone(), 'continue'))).toEqual([
      { action: 'held-as-wrong', after: 'run_line', at: NOW },
    ]);
    expect(
      acted(
        turnDone().resumeLine({
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

  it('cannot resume the line while a turn is in progress', () => {
    expect(() => resumption(driving(), 'continue')).toThrow(
      'Task task_1 has a turn in progress.',
    );
  });

  it('says when the person moved it elsewhere than an event asked', () => {
    const held = turnDone().deferMove(
      line,
      SHIP,
      said('The pull request was approved.', Voice.world()),
    );
    const back = resumption(held, 'move-on', REVIEW);

    expect(back.stationId.equals(REVIEW)).toBe(true);
    expect(lastOf(back)?.body.value).toContain(
      'An event asked to move the task to ship while the task was on hold.',
    );
  });

  it('finishes when an event asked to finish it while it was on hold', () => {
    const held = turnDone().deferMove(
      line,
      COMPLETED,
      said('The pull request was merged.', Voice.world()),
    );

    expect(held.resumeDestination(line, 'continue', null)?.id).toEqual(
      COMPLETED,
    );

    const back = held.resumeLine({
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
      'An event asked for this move while the task was on hold.',
    );
  });

  it('says on its note where the task went and what the person wrote', () => {
    const outcome = (task: Task) => {
      const handed = task.notes.find((each) => each.form === 'resumed');

      return handed?.resumption
        ? {
            next: handed.resumption.next,
            station: handed.resumption.station.value,
            summary: handed.resumption.summary,
          }
        : null;
    };

    expect(outcome(resumption(turnDone(), 'continue'))).toEqual({
      next: 'continue',
      station: 'build',
      summary: 'Kept the queue bounded.',
    });
    expect(outcome(resumption(turnDone(), 'move-on', REVIEW))).toEqual({
      next: 'move-on',
      station: 'check',
      summary: 'Kept the queue bounded.',
    });
    expect(outcome(resumption(turnDone(), 'finish'))).toEqual({
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
      .resumeLine({
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
    const handed = back.notes.find((each) => each.form === 'resumed');

    expect(handed?.resumption?.next).toBe('finish');
    expect(handed?.resumption?.summary).toBeNull();
  });

  it('is not stored with a resume note that says nothing of how it went', () => {
    const back = resumption(turnDone(), 'continue');

    expect(() =>
      Task.rehydrate({
        ...back,
        notes: back.notes.map((each) =>
          each.form === 'resumed'
            ? TaskNote.of({ ...each, resumption: null })
            : each,
        ),
      }),
    ).toThrow(InconsistentStateError);
  });

  it('does not count against a line run twice', () => {
    const answered = settled(
      running().putToAPerson(LINE_RUN, said('Done.', Voice.station(LINE_RUN))),
    );
    const once = resumption(turnDone(driving2(answered)), 'continue');

    expect(onHold(once, MAYA).openHold?.from).toBeNull();
  });

  it('holds from no run of a station it has left', () => {
    const answered = settled(
      running().putToAPerson(LINE_RUN, said('Done.', Voice.station(LINE_RUN))),
    );
    const held = heldBy(
      answered,
      LEON,
      'Try a ring buffer.',
      HoldId.of('hold_0'),
    ).assignRun(TURN, line);
    const moved = resumption(turnDone(held), 'move-on', REVIEW, 'exploring');

    expect(moved.stationId.equals(REVIEW)).toBe(true);
    expect(onHold(moved, MAYA).openHold?.from).toBeNull();
    expect(
      onHold(
        resumption(turnDone(held), 'continue', null, 'exploring'),
        MAYA,
      ).openHold?.from?.equals(LINE_RUN),
    ).toBe(true);
  });

  it('gives the line what arrived while it was on hold', () => {
    const withCheck = happenedOn(driving(), 'The checks failed.');
    const check = lastOf(withCheck)?.position;

    expect(lastOf(withCheck)?.unacknowledged).toBe(false);

    const back = resumption(turnDone(withCheck), 'continue');

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
      .answerAs(
        { person: LEON, team: ACTING },
        from,
        said('The retry queue.', Voice.person(LEON)),
      )
      .assignRun(LINE_RUN, line);
    const back = resumption(turnDone(driving2(second)), 'continue');

    expect(onHold(back, MAYA).openHold?.from).toBeNull();
  });

  it('resumes the line for any person, and keeps who put it on hold', () => {
    const resumed = turnDone().resumeLine({
      by: MAYA,
      line,
      next: 'continue',
      to: null,
      rank: null,
      verdict: 'exploring',
      summary: null,
      turnHeads: [],
      at: LATER,
    });

    expect(resumed.onHold).toBe(false);
    expect(resumed.holds[0]?.by.equals(LEON)).toBe(true);
    expect(lastOf(resumed)?.voice.author?.equals(MAYA)).toBe(true);
  });

  it('keeps what arrived while it was on hold away from the next station', () => {
    const withCheck = happenedOn(driving(), 'The checks failed.');
    const check = lastOf(withCheck)?.position;
    const unacknowledged = (task: Task) =>
      task.notes.find((note) => check && note.position.equals(check))
        ?.unacknowledged;

    expect(
      unacknowledged(resumption(turnDone(withCheck), 'move-on', REVIEW)),
    ).toBe(false);
    expect(unacknowledged(resumption(turnDone(withCheck), 'finish'))).toBe(
      false,
    );
  });

  it('leaves the line no instructions meant for the person’s turns when no turn ran', () => {
    const back = resumption(onHold(), 'continue');
    const putOnHold = back.notes.find((note) => note.form === 'held');

    expect(putOnHold?.unacknowledged).toBe(false);
  });

  it('credits a later hand move to the line run, never to a turn', () => {
    const back = resumption(turnDone(), 'continue');

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
    expect(() => resumption(turnDone(), 'move-on', null)).toThrow(
      'needs a station to move on to',
    );
    expect(() =>
      turnDone().resumeLine({
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
    const back = resumption(turnDone(), 'move-on', REVIEW);

    expect(back.stationId.equals(REVIEW)).toBe(true);
  });

  it('does not move on to a station its station does not pass work to', () => {
    expect(() => resumption(turnDone(), 'move-on', SHIP)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('finishes at the end of its line', () => {
    const back = resumption(turnDone(), 'finish');

    expect(back.stationId.equals(COMPLETED)).toBe(true);
    expect(back.finished).toBe(true);
  });

  it('cannot resume the line when it is not on hold', () => {
    expect(() => resumption(running(), 'continue')).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('holds from the next line run after a resume, not from a turn', () => {
    const lineAgain = RunId.of('run_line_2');
    const back = resumption(turnDone(), 'continue');

    expect(onHold(back, MAYA).openHold?.from).toBeNull();
    expect(
      onHold(back.assignRun(lineAgain, line), MAYA).openHold?.from?.equals(
        lineAgain,
      ),
    ).toBe(true);
  });

  it('says who took it over and from which run', () => {
    const event = onHold()
      .pullEvents()
      .find((each): each is TaskHeld => each instanceof TaskHeld);

    expect(event?.by.equals(LEON)).toBe(true);
    expect(event?.from?.equals(LINE_RUN)).toBe(true);
  });
});

describe('a message to a station run', () => {
  const working = () => running();

  it('puts the task on hold when a person steers the run working it', () => {
    expect(
      working().holdsOnMessage(LINE_RUN, Voice.person(MAYA), BUILD, line),
    ).toBe(true);
  });

  it('is an answer, not a hold, when the run asked a question', () => {
    const asking = working().putToAPerson(
      LINE_RUN,
      said('Which queue should I drain?', Voice.station(LINE_RUN)),
    );

    expect(
      asking.holdsOnMessage(LINE_RUN, Voice.person(MAYA), BUILD, line),
    ).toBe(false);
  });

  it('does not hold a task already on hold, finished, moved on, or at a station where no agent works', () => {
    const finished = working().finishHere(
      LINE_RUN,
      line,
      said('Opened the pull request.', Voice.station(LINE_RUN)),
    );

    expect(
      onHold().holdsOnMessage(LINE_RUN, Voice.person(LEON), BUILD, line),
    ).toBe(false);
    expect(
      finished.holdsOnMessage(LINE_RUN, Voice.person(LEON), BUILD, line),
    ).toBe(false);
    expect(
      working().holdsOnMessage(LINE_RUN, Voice.person(LEON), REVIEW, line),
    ).toBe(false);
    expect(
      at(BACKLOG).holdsOnMessage(LINE_RUN, Voice.person(LEON), BACKLOG, line),
    ).toBe(false);
  });

  const start = {
    id: HoldId.of('hold_1'),
    members: TEAM,
    line,
    currentRunStarted: true,
    at: NOW,
  };
  const ADMIN = UserId.of('user_admin');
  const ADMIN_OFF_THE_TEAM = TeamStanding.of({
    seesTeam: true,
    actsOnTeam: true,
    memberOfTeam: false,
  });

  it('puts the task on hold for a member who steers the run, and assigns it to them', () => {
    const held = working().heldOnMessage(
      LINE_RUN,
      start,
      said('Use a bounded queue.', Voice.person(MAYA)),
      BUILD,
      { person: MAYA, team: ACTING },
    );

    expect(held.openHold?.by).toEqual(MAYA);
    expect(held.assignee).toEqual(MAYA);
  });

  it('refuses an admin off the team, because a hold assigns the task', () => {
    expect(() =>
      working().heldOnMessage(
        LINE_RUN,
        start,
        said('Use a bounded queue.', Voice.person(ADMIN)),
        BUILD,
        { person: ADMIN, team: ADMIN_OFF_THE_TEAM },
      ),
    ).toThrow(NotOnTheTeamAskedError);
  });

  it('refuses the same message as a plain message, from a member and from an admin off the team', () => {
    expect(() =>
      working().receiveMessage(
        LINE_RUN,
        said('Use a bounded queue.', Voice.person(MAYA)),
        BUILD,
        { person: MAYA, team: ACTING },
      ),
    ).toThrow(InvalidTaskTransitionError);
    expect(() =>
      working().receiveMessage(
        LINE_RUN,
        said('Use a bounded queue.', Voice.person(ADMIN)),
        BUILD,
        { person: ADMIN, team: ADMIN_OFF_THE_TEAM },
      ),
    ).toThrow(NotOnTheTeamAskedError);
  });

  it('refuses to hold the task where a message holds nothing', () => {
    expect(() =>
      working().heldOnMessage(
        LINE_RUN,
        start,
        said('Use a bounded queue.', Voice.person(MAYA)),
        REVIEW,
        { person: MAYA, team: ACTING },
      ),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('adds a message to the task itself and puts nothing on hold, from a member and from an admin off the team', () => {
    for (const sender of [
      { person: MAYA, team: ACTING },
      { person: ADMIN, team: ADMIN_OFF_THE_TEAM },
    ]) {
      const words_ = said(
        'Try with the new image.',
        Voice.person(sender.person),
      );

      expect(
        working().holdsOnMessage(null, Voice.person(sender.person), null, line),
      ).toBe(false);

      const sent = working().receiveMessage(null, words_, null, sender);

      expect(sent.openHold).toBeNull();
      expect(sent.assignee).toEqual(LEON);
      expect(lastOf(sent)?.body).toEqual(words_.body);
      expect(() =>
        working().heldOnMessage(null, start, words_, null, sender),
      ).toThrow(InvalidTaskTransitionError);
    }
  });

  it('adds a message to an older run while a question waits on the current run, and leaves the task with the person it waits for', () => {
    const OLDER_RUN = RunId.of('run_older');
    const asking = working().putToAPerson(
      LINE_RUN,
      said('Which queue should I drain?', Voice.station(LINE_RUN)),
    );
    const words = said('Use a bounded queue.', Voice.person(MAYA));
    const maya = { person: MAYA, team: ACTING };

    expect(
      asking.holdsOnMessage(OLDER_RUN, Voice.person(MAYA), BUILD, line),
    ).toBe(false);
    expect(() =>
      asking.heldOnMessage(OLDER_RUN, start, words, BUILD, maya),
    ).toThrow(InvalidTaskTransitionError);

    const sent = asking.receiveMessage(OLDER_RUN, words, BUILD, maya);

    expect(sent.openHold).toBeNull();
    expect(sent.assignee).toEqual(LEON);
    expect(sent.pendingConversation).not.toBeNull();
  });

  it('does not hold the task for what the line or a station says', () => {
    expect(working().holdsOnMessage(LINE_RUN, Voice.world(), BUILD, line)).toBe(
      false,
    );
    expect(
      working().holdsOnMessage(LINE_RUN, Voice.station(LINE_RUN), BUILD, line),
    ).toBe(false);
  });
});

describe('a hand move of a task on hold', () => {
  const move = (task: Task, to: StationId, mover: UserId = LEON) =>
    task.moveTo(line, to, TaskRank.of('m'), said('Moved.', Voice.world()), {
      mover,
    });

  it('resumes the line where the person who holds it moves it', () => {
    const moved = move(turnDone(), COMPLETED);
    const events = moved.pullEvents();

    expect(moved.onHold).toBe(false);
    expect(moved.holds[0]?.end).toBe('finish');
    expect(moved.stationId).toEqual(COMPLETED);
    expect(lastOf(moved)?.form).toBe('resumed');
    expect(events.some((each) => each instanceof LineResumed)).toBe(true);
  });

  it('parks the task in the backlog as a move on', () => {
    const moved = move(turnDone(), BACKLOG);

    expect(moved.holds[0]?.end).toBe('move-on');
    expect(moved.stationId).toEqual(BACKLOG);
  });

  it('stops a turn in progress when the person moves the task', () => {
    const moved = move(driving(), COMPLETED);

    expect(moved.running).toBe(false);
    expect(moved.onHold).toBe(false);
  });

  it('resumes the line where a teammate moves it', () => {
    const moved = move(turnDone(), COMPLETED, MAYA);

    expect(moved.onHold).toBe(false);
    expect(moved.holds[0]?.end).toBe('finish');
  });
});

describe('a resume the agent asks for', () => {
  it('speaks as the turn that asked for it', () => {
    const resumed = turnDone().leaveRun(TURN, LATER).resumeLine({
      by: LEON,
      line,
      next: 'continue',
      to: null,
      rank: null,
      verdict: null,
      summary: 'The cards are flat now.',
      turnHeads: [],
      at: LATER,
      run: TURN,
    });
    const note = resumed.notes.find((each) => each.form === 'resumed');

    expect(note?.voice.run).toEqual(TURN);
    expect(note?.body.value).toContain(
      'About the changes:\n\nThe cards are flat now.',
    );
  });
});
