import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { TaskActedOn } from '@work/domain/events/task-acted-on.event';
import { TaskAsked } from '@work/domain/events/task-asked.event';
import { TaskFailed } from '@work/domain/events/task-failed.event';
import { TaskHandedOn } from '@work/domain/events/task-handed-on.event';
import type { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import { TaskMoved } from '@work/domain/events/task-moved.event';
import { InvalidTaskRevisionError } from '@work/domain/exceptions/invalid-task-revision.error';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { MoveRefusedError } from '@work/domain/exceptions/move-refused.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { StaleTaskRevisionError } from '@work/domain/exceptions/stale-task-revision.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import { UnreviewablePullRequestError } from '@work/domain/exceptions/unreviewable-pull-request.error';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { Said } from '@work/domain/value-objects/said.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskDescription } from '@work/domain/value-objects/task-description.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

const withNotes = (task: Task, ...notes: TaskNote[]) =>
  Task.rehydrate({
    revision: TaskRevision.first(),
    id: task.id,
    workspaceId: task.workspaceId,
    stationId: task.stationId,
    title: task.title,
    description: task.description,
    rank: task.rank,
    currentRunId: task.currentRunId,
    sessionId: task.sessionId,
    runnerId: task.runnerId,
    notes: [...task.notes, ...notes].map((each, place) =>
      TaskNote.of({ ...each, position: NotePosition.of(place) }),
    ),
    createdAt: task.createdAt,
    raisedAt: task.raisedAt,
    raisedBy: task.raisedBy,
    openedFrom: task.openedFrom,
    pullRequestLink: task.pullRequestLink,
    finishedAt: task.finishedAt,
  });

const added = (description?: TaskDescription) =>
  Task.add({
    line: LINE,
    at: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    description,
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const NOW = new Date('2026-08-29T12:00:00.000Z');

const actsOf = (task: Task) =>
  task
    .pullEvents()
    .filter((each): each is TaskActedOn => each instanceof TaskActedOn)
    .map((each) => ({
      act: each.act,
      by: each.by.value,
      after: each.after?.value ?? null,
    }));

const station = (
  id: string,
  name: string,
  position: number,
  over: Partial<Parameters<typeof Station.of>[0]> = {},
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(id.replace('_', '-')),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    ...over,
  });

const LINE = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station('station_0', 'Backlog', 0, { kind: 'backlog' }),
    station('station_1', 'Triage', 1, {
      harness: HarnessId.of('dev'),
      wayOut: WayOut.of({ stations: [StationId.of('station_2')], ends: true }),
    }),
    station('station_2', 'Spec', 2, { harness: HarnessId.of('dev') }),
    station('completed_1', 'Completed', 3, { kind: 'completed' }),
  ],
});

const RUN = RunId.of('run_1');

const HERE = StationId.of('station_1');

const saying = {
  station: StationName.of('Triage'),
  body: TaskNoteBody.of('Reproduced on restart.'),
  at: NOW,
  voice: Voice.station(),
};

describe('Task', () => {
  it('stands at the station it was added to', () => {
    expect(added().stationId).toEqual(StationId.of('station_1'));
  });

  it('belongs to the workspace of the line it was added to', () => {
    expect(added().workspaceId).toEqual(LINE.workspaceId);
  });

  it('will not be added at a station off its line', () => {
    expect(() =>
      Task.add({
        line: LINE,
        at: StationId.of('station_9'),
        title: TaskTitle.of('Fix the queue'),
        rank: TaskRank.of('i'),
        now: NOW,
        newId: () => 'task_1',
      }),
    ).toThrow(UnknownStationError);
  });

  it('remembers it was opened by a person, or heard from an integration', () => {
    expect(added().openedFrom.value).toBe('person');

    const heard = Task.add({
      line: LINE,
      at: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      heardFrom: Happening.of('slack.app_mention'),
      now: NOW,
      newId: () => 'task_1',
    });

    expect(heard.openedFrom.value).toBe('slack');
    expect(heard.pullEvents()).toContainEqual(
      expect.objectContaining({ kind: 'task.opened', heard: true }),
    );
  });

  it('is added without a description', () => {
    expect(added().description).toBeNull();
  });

  it('keeps the description it was given', () => {
    const task = added(TaskDescription.of('## Steps'));

    expect(task.description?.value).toBe('## Steps');
  });

  it('remembers when it was raised', () => {
    expect(added().createdAt).toEqual(new Date('2026-08-27T09:15:00.000Z'));
  });

  it('takes an identity of its own', () => {
    expect(added().id.value).toBe('task_1');
  });

  it('stands at the station it was moved to', () => {
    const moved = added().reactedTo(
      LINE,
      StationId.of('station_2'),
      TaskRank.of('m'),
      saying,
    );

    expect(moved.stationId).toEqual(StationId.of('station_2'));
  });

  it('keeps everything else across a move', () => {
    const moved = added(TaskDescription.of('## Steps')).reactedTo(
      LINE,
      StationId.of('station_2'),
      TaskRank.of('m'),
      saying,
    );

    expect(moved.id.value).toBe('task_1');
    expect(moved.title.value).toBe('Fix the queue');
    expect(moved.description?.value).toBe('## Steps');
  });

  it('leaves the task it was moved from where it stood', () => {
    const task = added();
    task.reactedTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

    expect(task.stationId).toEqual(StationId.of('station_1'));
  });

  it('takes a new place in the station it already stands at', () => {
    const reordered = added().reorderTo(TaskRank.of('m'));

    expect(reordered.rank.value).toBe('m');
    expect(reordered.stationId).toEqual(StationId.of('station_1'));
  });

  it('keeps a note of what a station left behind', () => {
    const worked = withNotes(
      added(),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.station(),
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Reproduced on restart.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
        kind: 'passed',
      }),
    );

    expect(worked.notes.map((each) => each.body.value)).toEqual([
      'Reproduced on restart.',
    ]);
  });

  it('keeps its notes in the order they were left', () => {
    const worked = withNotes(
      added(),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.station(),
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('First'),
        at: new Date('2026-08-28T10:00:00.000Z'),
        kind: 'passed',
      }),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.station(),
        station: StationName.of('Spec'),
        body: TaskNoteBody.of('Second'),
        at: new Date('2026-08-28T11:00:00.000Z'),
        kind: 'passed',
      }),
    );

    expect(worked.notes.map((each) => each.station.value)).toEqual([
      'Triage',
      'Spec',
    ]);
  });

  it('carries what was said across a move, and records the move', () => {
    const worked = withNotes(
      added(),
      TaskNote.of({
        position: NotePosition.of(0),
        voice: Voice.station(),
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Reproduced.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
        kind: 'passed',
      }),
    ).reactedTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

    expect(worked.notes).toHaveLength(2);
    expect(worked.notes[0]?.body.value).toBe('Reproduced.');
    expect(worked.notes[1]?.kind).toBe('passed');
  });

  it('is the same task as another of the same id', () => {
    expect(added().equals(added())).toBe(true);
  });
});

describe('Task, what it is doing', () => {
  const raised = () =>
    Task.add({
      line: LINE,
      at: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      raisedBy: UserId.of('user_1'),
      now: new Date('2026-08-28T12:00:00.000Z'),
      newId: () => 'task_1',
    });

  const asked = () =>
    TaskNote.of({
      position: NotePosition.of(0),
      voice: Voice.station(),
      station: StationName.of('Triage'),
      body: TaskNoteBody.of('Which queue did you mean?'),
      at: new Date('2026-08-28T12:00:00.000Z'),
      kind: 'passed',
    });

  it('is idle when nobody has taken it up', () => {
    const task = raised();

    expect(task.running).toBe(false);
    expect(task.idle).toBe(true);
  });

  it('is not idle while a run holds it', () => {
    const task = raised().handedTo(RunId.of('run_1'), LINE);

    expect(task.running).toBe(true);
    expect(task.idle).toBe(false);
  });

  it('is not idle while it waits on a person', () => {
    const task = raised().askedAbout(asked(), null);

    expect(task.running).toBe(false);
    expect(task.idle).toBe(false);
  });
  describe('the conversation it was worked in', () => {
    const session = HarnessSession.of('session_1');
    const runner = RunnerId.of('runner_1');

    it('is not there until a run has worked it', () => {
      expect(added().sessionId).toBeNull();
    });

    it('is remembered once one has, with the runner that holds it', () => {
      const worked = added().workedIn(session, runner);

      expect(worked.sessionId).toEqual(session);
      expect(worked.runnerId).toEqual(runner);
    });

    it('survives being put to a person', () => {
      const asked = added().workedIn(session, runner).askedAbout(saying, null);

      expect(asked.sessionId).toEqual(session);
      expect(asked.runnerId).toEqual(runner);
      expect(asked.awaitingReview).toBe(true);
    });

    it('is left behind when the task is passed on', () => {
      const passed = added()
        .workedIn(session, runner)
        .reactedTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(passed.sessionId).toBeNull();
      expect(passed.runnerId).toBeNull();
    });

    it('is left behind when the task is moved by hand', () => {
      const moved = added()
        .workedIn(session, runner)
        .reactedTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(moved.sessionId).toBeNull();
      expect(moved.runnerId).toBeNull();
    });

    it('names the one workspace every run of it works in, at whichever station', () => {
      const moved = added().reactedTo(
        LINE,
        StationId.of('station_2'),
        TaskRank.of('m'),
        saying,
      );

      expect(added().continuity().key.value).toBe('task-task_1');
      expect(moved.continuity().key.equals(added().continuity().key)).toBe(
        true,
      );
    });

    it('hands the conversation to the next run', () => {
      const carried = added().workedIn(session, runner).continuity();

      expect(carried.sessionId).toEqual(session);
    });

    it('asks for no conversation when there is none to return to', () => {
      expect(added().continuity().sessionId).toBeNull();
    });

    it('survives a person answering what it was waiting on', () => {
      const answered = added()
        .workedIn(session, runner)
        .askedAbout(saying, null)
        .answered(NotePosition.of(0), saying);

      expect(answered.awaitingReview).toBe(false);
      expect(answered.sessionId).toEqual(session);
      expect(answered.runnerId).toEqual(runner);
      expect(answered.stationId).toEqual(StationId.of('station_1'));
    });

    it('survives being reordered where it stands', () => {
      const reordered = added()
        .workedIn(session, runner)
        .reorderTo(TaskRank.of('m'));

      expect(reordered.sessionId).toEqual(session);
      expect(reordered.runnerId).toEqual(runner);
      expect(reordered.stationId).toEqual(StationId.of('station_1'));
    });
  });

  describe('waiting on a person', () => {
    it('waits from the asking until they answer', () => {
      const asked = added().askedAbout(saying, null);

      expect(asked.awaitingReview).toBe(true);
      expect(asked.answered(NotePosition.of(0), saying).awaitingReview).toBe(
        false,
      );
    });

    it('stops waiting once the task is moved by hand', () => {
      const moved = added()
        .askedAbout(saying, null)
        .reactedTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(moved.awaitingReview).toBe(false);
    });
  });

  describe('what a person is owed', () => {
    it('owes nobody until it is put to someone', () => {
      expect(added().openConversation).toBeNull();
    });

    it('owes an ending once it has been put to someone', () => {
      expect(added().askedAbout(saying, null).openConversation).toEqual({
        from: 0,
        to: null,
      });
    });

    it('still owes it after an answer', () => {
      const asked = added()
        .askedAbout(saying, null)
        .answered(NotePosition.of(0), saying);

      expect(asked.openConversation).not.toBeNull();
    });

    it('owes nothing once it has moved on', () => {
      const passed = added()
        .askedAbout(saying, null)
        .reactedTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(passed.openConversation).toBeNull();
    });

    it('refuses an answer to something nobody was asked', () => {
      expect(() => added().answered(NotePosition.of(0), saying)).toThrow(
        InvalidTaskTransitionError,
      );
    });
  });

  describe('who it belongs to', () => {
    it('comes back to whoever raised it', () => {
      expect(added().raisedByThem(UserId.of('user_1'))).toBe(true);
    });

    it('belongs to nobody else, however much of the workspace they see', () => {
      expect(added().raisedByThem(UserId.of('user_2'))).toBe(false);
    });

    it('is owned by whoever raised it from the start', () => {
      expect(added().assignedToThem(UserId.of('user_1'))).toBe(true);
    });

    it('falls back to the raiser when a person is asked and none is set', () => {
      const asked = added().unassigned().askedAbout(saying, null);

      expect(asked.assignedToThem(UserId.of('user_1'))).toBe(true);
    });

    it('keeps the assignee it already has when a person is asked', () => {
      const asked = added()
        .assignedTo(UserId.of('user_2'))
        .askedAbout(saying, null);

      expect(asked.assignedToThem(UserId.of('user_2'))).toBe(true);
      expect(asked.assignedToThem(UserId.of('user_1'))).toBe(false);
    });
  });

  describe('reading what was put to a person', () => {
    const READ = new Date('2026-08-29T12:30:00.000Z');
    const asked = () => added().askedAbout(saying, null);

    it('leaves an ask unread until the person opens it', () => {
      expect(asked().notes[0]?.unread).toBe(true);
    });

    it('marks it read when they do', () => {
      expect(asked().read(NotePosition.of(0), READ).notes[0]?.readAt).toEqual(
        READ,
      );
    });

    it('says a conversation holds something unseen, until it is read', () => {
      expect(asked().unreadFrom(NotePosition.of(0))).toBe(true);
      expect(
        asked().read(NotePosition.of(0), READ).unreadFrom(NotePosition.of(0)),
      ).toBe(false);
    });

    it('leaves what was already read when it was first read', () => {
      const read = asked().read(NotePosition.of(0), READ);

      expect(
        read.read(NotePosition.of(0), new Date('2026-08-29T13:00:00.000Z'))
          .notes[0]?.readAt,
      ).toEqual(READ);
    });

    it('reads the whole conversation, not only the note it opens with', () => {
      const carried = asked()
        .answered(NotePosition.of(0), {
          ...saying,
          voice: Voice.person(UserId.of('user_1')),
        })
        .askedAbout(saying, null)
        .read(NotePosition.of(0), READ);

      expect(carried.notes.map((note) => note.unread)).toEqual([
        false,
        false,
        false,
      ]);
    });

    it('is unread again when the station asks something new', () => {
      const again = asked()
        .read(NotePosition.of(0), READ)
        .answered(NotePosition.of(0), {
          ...saying,
          voice: Voice.person(UserId.of('user_1')),
        })
        .askedAbout(saying, null);

      expect(again.notes[2]?.unread).toBe(true);
    });

    it('will not read a conversation that does not begin there', () => {
      expect(() => asked().read(NotePosition.of(1), READ)).toThrow(
        InvalidTaskTransitionError,
      );
    });
  });

  describe('saying something to the agent working it', () => {
    const here = StationId.of('station_1');
    const aloud = { ...saying, voice: Voice.person(UserId.of('user_1')) };

    it('joins the trail where the task still stands', () => {
      const told = added().heard(aloud, here);

      expect(told.notes[0]?.kind).toBe('said');
      expect(told.notes[0]?.body.value).toBe('Reproduced on restart.');
    });

    it('waits to be delivered', () => {
      expect(added().heard(aloud, here).undelivered).toHaveLength(1);
    });

    it('is delivered once the agent has been given it', () => {
      const told = added()
        .heard(aloud, here)
        .deliveredUpTo(NotePosition.of(0), NOW);

      expect(told.undelivered).toHaveLength(0);
    });

    it('will not be said to a station the task has left', () => {
      const moved = added().reactedTo(
        LINE,
        StationId.of('station_2'),
        TaskRank.of('m'),
        saying,
      );

      expect(() => moved.heard(aloud, here)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('leaves what a station said out of what is undelivered', () => {
      expect(added().askedAbout(saying, null).undelivered).toHaveLength(0);
    });

    it('sends a task finished at a worked station back to work there when a person speaks in its run', () => {
      const finished = added()
        .handedTo(RUN, LINE)
        .finishedHere(RUN, LINE, saying);

      expect(finished.wantsRun(LINE)).toBe(false);

      const told = finished.spokenTo(RUN, aloud, here);

      expect(told.finished).toBe(false);
      expect(told.stationId).toEqual(here);
      expect(told.wantsRun(LINE)).toBe(true);
      expect(told.undelivered.map((note) => note.body.value)).toEqual([
        'Reproduced on restart.',
      ]);
    });

    it('sends a task left idle at a worked station back to work when a person speaks in its last run', () => {
      const idle = added().handedTo(RUN, LINE).leftBy(RUN, NOW);

      expect(idle.spokenTo(RUN, aloud, here).wantsRun(LINE)).toBe(true);
    });

    it('hands what a person says to the run still working it, wanting no second run', () => {
      const told = added().handedTo(RUN, LINE).spokenTo(RUN, aloud, here);

      expect(told.heldBy(RUN)).toBe(true);
      expect(told.wantsRun(LINE)).toBe(false);
      expect(told.undelivered).toHaveLength(1);
    });

    it('tells that a person sent a finished task back, after the run they spoke in', () => {
      const told = added()
        .handedTo(RUN, LINE)
        .finishedHere(RUN, LINE, saying)
        .spokenTo(RUN, aloud, here);

      expect(actsOf(told)).toEqual([
        { act: 'sent-back', by: 'user_1', after: 'run_1' },
      ]);
    });

    it('tells that a person answered what the task was waiting on', () => {
      const told = added().askedAbout(saying, null).spokenTo(RUN, aloud, here);

      expect(actsOf(told)).toEqual([
        { act: 'answered', by: 'user_1', after: null },
      ]);
    });

    it('tells nothing a person did when they speak to the run still working it', () => {
      expect(
        actsOf(added().handedTo(RUN, LINE).spokenTo(RUN, aloud, here)),
      ).toEqual([]);
    });

    it('keeps a task waiting on a person when what is said there is no answer', () => {
      const asked = added().askedAbout(saying, null);
      const told = asked.heard(aloud, here);

      expect(told.awaitingReview).toBe(true);
      expect(told.wantsRun(LINE)).toBe(false);
    });
  });

  describe('answering what was said on the pull request', () => {
    const spoken = {
      ...saying,
      voice: Voice.world(),
      said: Said.of({
        body: 'pin this.',
        path: 'compose.yml',
        from: 22,
        remark: 'PRRC_kwDO',
      }),
    };

    const opened = () =>
      added()
        .handedTo(RUN, LINE)
        .openedAt(
          RUN,
          PullRequestUrl.of('https://github.com/acme/widgets/pull/7'),
          NOW,
          LINE,
        );

    it('offers what nobody has answered, and nothing else', () => {
      const heard = added().heard(spoken);

      expect(heard.openRemarks.map((each) => each.at.value)).toEqual([0]);
      expect(added().askedAbout(saying, null).openRemarks).toEqual([]);
    });

    it('says what it said back, and marks the remark answered', () => {
      const replied = opened()
        .heard(spoken)
        .repliedTo(RUN, HERE, NotePosition.of(0), saying);

      expect(replied.notes[0]?.answeredAt).toEqual(NOW);
      expect(replied.openRemarks).toEqual([]);
      expect(replied.notes[1]?.kind).toBe('said');
      expect(replied.notes[1]?.voice.isStation).toBe(true);
    });

    it('leaves what it said back out of what is undelivered', () => {
      const replied = opened()
        .heard(spoken)
        .deliveredUpTo(NotePosition.of(0), NOW)
        .repliedTo(RUN, HERE, NotePosition.of(0), saying);

      expect(replied.undelivered).toEqual([]);
    });

    it('will not answer a remark twice, or one that was never made', () => {
      const replied = opened()
        .heard(spoken)
        .repliedTo(RUN, HERE, NotePosition.of(0), saying);

      expect(() =>
        replied.repliedTo(RUN, HERE, NotePosition.of(0), saying),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        opened().repliedTo(RUN, HERE, NotePosition.of(0), saying),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not answer from a station the task has left', () => {
      const heard = opened().heard(spoken);

      expect(() =>
        heard.remarkAnswerableFrom(
          RUN,
          StationId.of('station_2'),
          NotePosition.of(0),
        ),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        heard.remarkAnswerableFrom(RUN, null, NotePosition.of(0)),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not answer where there is no pull request to answer on', () => {
      expect(() =>
        added()
          .handedTo(RUN, LINE)
          .heard(spoken)
          .remarkAnswerableFrom(RUN, HERE, NotePosition.of(0)),
      ).toThrow(NoRepositoryError);
    });

    it('answers only for the run that holds it', () => {
      const heard = opened().heard(spoken);

      expect(() =>
        heard.remarkAnswerableFrom(RunId.of('run_2'), HERE, NotePosition.of(0)),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        heard.repliedTo(RunId.of('run_2'), HERE, NotePosition.of(0), saying),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('names the pull request, its repository and the remark it answers', () => {
      const answering = opened()
        .heard(spoken)
        .remarkAnswerableFrom(RUN, HERE, NotePosition.of(0));

      expect(answering.repository.value).toBe('acme/widgets');
      expect(answering.remark.value).toBe('PRRC_kwDO');
    });
  });

  describe('what it refuses', () => {
    it('will not be put to a person twice over', () => {
      expect(() =>
        added().askedAbout(saying, null).askedAbout(saying, null),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not settle what nothing opened', () => {
      expect(() => added().settled(saying)).toThrow(InvalidTaskTransitionError);
    });

    it('will not settle the same conversation twice', () => {
      expect(() =>
        added().askedAbout(saying, null).settled(saying).settled(saying),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not be taken up while a person is asked, once finished, or where nothing runs', () => {
      expect(() =>
        added().askedAbout(saying, null).handedTo(RUN, LINE),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        added()
          .reactedTo(
            LINE,
            StationId.of('completed_1'),
            TaskRank.of('m'),
            saying,
          )
          .handedTo(RUN, LINE),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        added()
          .reactedTo(LINE, StationId.of('station_0'), TaskRank.of('m'), saying)
          .handedTo(RUN, LINE),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not be taken up by a second run while one holds it', () => {
      expect(() =>
        added()
          .handedTo(RunId.of('run_1'), LINE)
          .handedTo(RunId.of('run_2'), LINE),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not be passed to the station it already stands at', () => {
      expect(() =>
        added().reactedTo(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          saying,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not answer a conversation that has already closed', () => {
      const carried = added()
        .askedAbout(saying, null)
        .reactedTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying)
        .askedAbout(saying, null);

      expect(() => carried.answered(NotePosition.of(0), saying)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(carried.answered(NotePosition.of(2), saying).notes).toHaveLength(
        4,
      );
    });

    it('will not be moved to the station it already stands at', () => {
      expect(() =>
        added().reactedTo(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          saying,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('is finished once a run has nothing further to do with it', () => {
      const ended = added().handedTo(RUN, LINE).finishedHere(RUN, LINE, saying);

      expect(ended.finished).toBe(true);
      expect(ended.currentRunId).toBeNull();
      expect(ended.heard({ ...saying, voice: Voice.world() }).finished).toBe(
        false,
      );
    });

    it('finishes the task when it is moved to the end of the line', () => {
      const landed = added().reactedTo(
        LINE,
        StationId.of('completed_1'),
        TaskRank.of('m'),
        saying,
      );

      expect(landed.finished).toBe(true);
      expect(landed.currentRunId).toBeNull();
    });

    it('is unfinished again once a person answers what was put to them', () => {
      const asked = added()
        .handedTo(RUN, LINE)
        .finishedHere(RUN, LINE, saying)
        .askedAbout(saying, null);

      expect(
        asked.answered(NotePosition.of(1), {
          ...saying,
          voice: Voice.person(UserId.of('user_1')),
        }).finished,
      ).toBe(false);
    });
  });

  describe('letting go of a run', () => {
    const letGo = (task: Task) =>
      task
        .pullEvents()
        .filter((each) => each.kind === 'task.let-go-of-run')
        .map((each) => (each as TaskLetGoOfRun).runId);

    const held = () => {
      const task = added().handedTo(RUN, LINE);
      task.pullEvents();
      return task;
    };

    it('lets go of the run holding it when moved by hand', () => {
      expect(
        letGo(
          held().moveTo(
            LINE,
            StationId.of('station_0'),
            TaskRank.of('m'),
            saying,
            { mover: UserId.of('user_1') },
          ),
        ),
      ).toEqual([RUN]);
    });

    it('lets go of the run holding it when deleted', () => {
      const gone = held().deleted();

      expect(gone.currentRunId).toBeNull();
      expect(letGo(gone)).toEqual([RUN]);
    });

    it('lets go of nothing when no run holds it', () => {
      expect(
        letGo(
          added().reactedTo(
            LINE,
            StationId.of('station_2'),
            TaskRank.of('m'),
            saying,
          ),
        ),
      ).toEqual([]);
      expect(letGo(added().deleted())).toEqual([]);
    });

    it('lets go of nothing when the run holding it passes it on', () => {
      expect(
        letGo(
          held().passedOn(
            RUN,
            LINE,
            StationId.of('station_2'),
            TaskRank.of('m'),
            saying,
          ),
        ),
      ).toEqual([]);
    });
  });

  describe('opening a pull request', () => {
    const url = PullRequestUrl.of('https://github.com/acme/widgets/pull/7');

    it('is opened only for the run that holds it', () => {
      expect(() => added().openedAt(RUN, url, NOW, LINE)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() =>
        added().handedTo(RUN, LINE).openedAt(RunId.of('run_2'), url, NOW, LINE),
      ).toThrow(InvalidTaskTransitionError);
      expect(
        added().handedTo(RUN, LINE).openedAt(RUN, url, NOW, LINE).pullRequest,
      ).toEqual(url);
    });
  });

  describe('reviewing a pull request', () => {
    const url = PullRequestUrl.of('https://github.com/acme/widgets/pull/7');

    it('wears the pull request, and reviews it rather than owning it', () => {
      const reviewing = added().reviews(url, { outside: false });

      expect(reviewing.pullRequest).toEqual(url);
      expect(reviewing.reviewing).toBe(true);
      expect(reviewing.reviewedHead).toEqual({
        repository: Repository.of('acme/widgets'),
        ref: 'refs/pull/7/head',
      });
      expect(reviewing.marks.map(String)).toEqual([
        `github.review:${url.value}`,
      ]);
    });

    it('says which pull request it reviews, so Insights can tell people’s pull requests Spotlight touched', () => {
      const reviewing = added().reviews(url, { outside: false });

      expect(reviewing.pullEvents()).toContainEqual(
        expect.objectContaining({
          kind: 'task.pull-request-review-taken',
          taskId: reviewing.id,
          url,
        }),
      );
    });

    it('reviews only a pull request whose head it can check out', () => {
      expect(() =>
        added().reviews(PullRequestUrl.of('https://gitlab.example/acme/7'), {
          outside: false,
        }),
      ).toThrow(UnreviewablePullRequestError);
    });

    it('reviews nothing once it has a pull request of its own', () => {
      const own = added().handedTo(RUN, LINE).openedAt(RUN, url, NOW, LINE);

      expect(own.reviewing).toBe(false);
      expect(own.reviewedHead).toBeNull();
      expect(() => own.reviews(url, { outside: false })).toThrow(
        InvalidTaskTransitionError,
      );
    });
  });

  describe('routed by a run', () => {
    const held = () => added().handedTo(RUN, LINE);
    const other = RunId.of('run_2');

    it('is passed on only by the run that holds it', () => {
      expect(() =>
        held().passedOn(
          other,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          saying,
        ),
      ).toThrow(InvalidTaskTransitionError);
      expect(
        held().passedOn(
          RUN,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          saying,
        ).stationId,
      ).toEqual(StationId.of('station_2'));
    });

    it('is passed on only where the line leads from where it stands', () => {
      expect(() =>
        held().passedOn(
          RUN,
          LINE,
          StationId.of('station_0'),
          TaskRank.of('m'),
          saying,
        ),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('is finished only by the run that holds it', () => {
      expect(() => held().finishedHere(other, LINE, saying)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() => added().finishedHere(RUN, LINE, saying)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('is finished only where its line ends', () => {
      const passed = held()
        .passedOn(
          RUN,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          saying,
        )
        .handedTo(RUN, LINE);

      expect(() => passed.finishedHere(RUN, LINE, saying)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('is put to a person by the run that holds it, or by nobody while no run does', () => {
      expect(() => held().askedAbout(saying, other)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() => held().askedAbout(saying, null)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() => added().askedAbout(saying, RUN)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(held().askedAbout(saying, RUN).running).toBe(false);
    });
  });

  describe('moving along its line', () => {
    const ELSEWHERE = Line.rehydrate({
      id: LineId.of('line_2'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('ops'),
      name: LineName.of('Ops'),
      stations: [
        station('station_9', 'Backlog', 0, { kind: 'backlog' }),
        station('completed_9', 'Completed', 1, { kind: 'completed' }),
      ],
    });

    it('will not be moved by a line it does not stand on', () => {
      expect(() =>
        added().reactedTo(
          ELSEWHERE,
          ELSEWHERE.backlog.id,
          TaskRank.of('m'),
          saying,
        ),
      ).toThrow(UnknownStationError);
    });

    it('will not be moved to a station off its line', () => {
      expect(() =>
        added().reactedTo(LINE, ELSEWHERE.backlog.id, TaskRank.of('m'), saying),
      ).toThrow(UnknownStationError);
    });

    it('will not be passed on to a station off its line', () => {
      expect(() =>
        added()
          .handedTo(RUN, LINE)
          .passedOn(RUN, LINE, ELSEWHERE.backlog.id, TaskRank.of('m'), saying),
      ).toThrow(UnknownStationError);
    });

    const inBacklog = () =>
      Task.add({
        line: LINE,
        at: StationId.of('station_0'),
        title: TaskTitle.of('Fix the queue'),
        rank: TaskRank.of('i'),
        now: NOW,
        newId: () => 'task_1',
      });

    const mover = { mover: UserId.of('user_2') };

    it('is taken up by whoever moves it by hand out of the backlog into work', () => {
      expect(
        inBacklog().moveTo(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          saying,
          mover,
        ).assignee,
      ).toEqual(UserId.of('user_2'));
    });

    it('is not taken up when parked back in the backlog by hand', () => {
      expect(
        added()
          .unassigned()
          .moveTo(
            LINE,
            StationId.of('station_0'),
            TaskRank.of('m'),
            saying,
            mover,
          ).assignee,
      ).toBeNull();
    });

    it('is not taken up when it leaves the backlog without a hand to move it', () => {
      expect(
        inBacklog().reactedTo(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          saying,
        ).assignee,
      ).toBeNull();
    });
  });

  describe('moved by a person', () => {
    const hand = { mover: UserId.of('user_2') };
    const BACKLOG = StationId.of('station_0');
    const COMPLETED = StationId.of('completed_1');

    const at = (stationId: StationId) =>
      Task.add({
        line: LINE,
        at: stationId,
        title: TaskTitle.of('Fix the queue'),
        rank: TaskRank.of('i'),
        now: NOW,
        newId: () => 'task_1',
      });

    const moved = (from: StationId, to: StationId) =>
      at(from).moveTo(LINE, to, TaskRank.of('m'), saying, hand);

    it('starts from the backlog at any work station', () => {
      expect(moved(BACKLOG, HERE).stationId).toEqual(HERE);
      expect(moved(BACKLOG, StationId.of('station_2')).stationId).toEqual(
        StationId.of('station_2'),
      );
    });

    it('closes from anywhere into completed', () => {
      expect(moved(BACKLOG, COMPLETED).finished).toBe(true);
      expect(moved(HERE, COMPLETED).finished).toBe(true);
    });

    it('parks from a work station back in the backlog, letting go of its run', () => {
      const parked = at(HERE)
        .handedTo(RUN, LINE)
        .moveTo(LINE, BACKLOG, TaskRank.of('m'), saying, hand);

      expect(parked.stationId).toEqual(BACKLOG);
      expect(parked.running).toBe(false);
      expect(parked.pullEvents().map((each) => each.kind)).toContain(
        'task.let-go-of-run',
      );
    });

    it('tells whether a person started, parked or closed it', () => {
      expect(actsOf(moved(BACKLOG, HERE))).toEqual([
        { act: 'started', by: 'user_2', after: null },
      ]);
      expect(actsOf(moved(HERE, BACKLOG))).toEqual([
        { act: 'parked', by: 'user_2', after: null },
      ]);
      expect(actsOf(moved(HERE, COMPLETED))).toEqual([
        { act: 'closed', by: 'user_2', after: null },
      ]);
    });

    it('names the run that last spoke on it when a person closes it', () => {
      const finished = at(HERE)
        .handedTo(RUN, LINE)
        .finishedHere(RUN, LINE, { ...saying, voice: Voice.station(RUN) });
      const reopened = finished.spokenTo(
        RUN,
        { ...saying, voice: Voice.person(UserId.of('user_1')) },
        HERE,
      );
      reopened.pullEvents();

      expect(
        actsOf(
          reopened.moveTo(LINE, COMPLETED, TaskRank.of('m'), saying, hand),
        ),
      ).toEqual([{ act: 'closed', by: 'user_2', after: 'run_1' }]);
    });

    it('tells nothing a person did when a reaction moves it', () => {
      expect(
        actsOf(
          at(HERE).reactedTo(
            LINE,
            StationId.of('station_2'),
            TaskRank.of('m'),
            saying,
          ),
        ),
      ).toEqual([]);
    });

    it('will not be moved between work stations, which its runs pass it along', () => {
      expect(() => moved(HERE, StationId.of('station_2'))).toThrow(
        new MoveRefusedError('between-work-stations', 'Triage', 'Spec'),
      );
    });

    it('will not be moved out of completed', () => {
      const closed = moved(HERE, COMPLETED);

      expect(() =>
        closed.moveTo(LINE, BACKLOG, TaskRank.of('m'), saying, hand),
      ).toThrow(MoveRefusedError);
      expect(() =>
        closed.moveTo(LINE, HERE, TaskRank.of('m'), saying, hand),
      ).toThrow(MoveRefusedError);
    });

    it('is moved between work stations by a reaction, without a hand', () => {
      expect(
        at(HERE).reactedTo(
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          saying,
        ).stationId,
      ).toEqual(StationId.of('station_2'));
    });
  });

  describe('wanting a run', () => {
    it('wants one while idle at a station something runs at', () => {
      expect(added().wantsRun(LINE)).toBe(true);
    });

    it('wants none while a run holds it, a person is asked, or it is finished', () => {
      expect(added().handedTo(RUN, LINE).wantsRun(LINE)).toBe(false);
      expect(added().askedAbout(saying, null).wantsRun(LINE)).toBe(false);
      expect(
        added()
          .reactedTo(
            LINE,
            StationId.of('completed_1'),
            TaskRank.of('m'),
            saying,
          )
          .wantsRun(LINE),
      ).toBe(false);
    });

    it('wants none where nothing runs', () => {
      expect(
        added()
          .reactedTo(LINE, StationId.of('station_0'), TaskRank.of('m'), saying)
          .wantsRun(LINE),
      ).toBe(false);
    });
  });

  describe('its trail', () => {
    it('will not stand with a gap in it', () => {
      expect(() =>
        Task.rehydrate({
          ...added(),
          notes: [
            TaskNote.of({
              ...saying,
              kind: 'said',
              position: NotePosition.of(1),
            }),
          ],
        }),
      ).toThrow(InconsistentStateError);
    });
  });

  describe('telling where it moved', () => {
    const movedEvents = (task: Task) =>
      task.pullEvents().filter((each) => each instanceof TaskMoved);

    it('says it moved from one station’s key to another’s, and when', () => {
      const task = added();
      task.pullEvents();

      const [moved] = movedEvents(
        task.reactedTo(
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          saying,
        ),
      );

      expect(moved).toEqual(
        new TaskMoved(
          task.id,
          task.workspaceId,
          StationKey.of('station-1'),
          StationKey.of('station-2'),
          NOW,
        ),
      );
    });

    it('says it moved when a run passes it on', () => {
      const held = added().handedTo(RUN, LINE);
      held.pullEvents();

      const [moved] = movedEvents(
        held.passedOn(
          RUN,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          saying,
        ),
      );

      expect(moved?.to).toEqual(StationKey.of('station-2'));
    });

    it('says nothing moved when it is only reordered', () => {
      const task = added();
      task.pullEvents();

      expect(movedEvents(task.reorderTo(TaskRank.of('z')))).toEqual([]);
    });

    it('says which run handed it on, from where to where and when', () => {
      const held = added().handedTo(RUN, LINE);
      held.pullEvents();

      const handedOn = held
        .passedOn(
          RUN,
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          saying,
        )
        .pullEvents()
        .filter((each) => each instanceof TaskHandedOn);

      expect(handedOn).toEqual([
        new TaskHandedOn(
          held.id,
          held.workspaceId,
          RUN,
          HERE,
          StationId.of('station_2'),
          NOW,
        ),
      ]);
    });

    it('says nothing was handed on when a happening moves it', () => {
      const task = added();
      task.pullEvents();

      expect(
        task
          .reactedTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying)
          .pullEvents()
          .filter((each) => each instanceof TaskHandedOn),
      ).toEqual([]);
    });
  });
});

describe('Task, a failure reported on it', () => {
  const RUN_EXITED = TaskFailure.fromRun('exited');
  const LOOPED = TaskFailure.fromHook('notify', 'loop');
  const worked = () => added().handedTo(RUN, LINE);
  const failure = (said: string) => ({
    ...saying,
    body: TaskNoteBody.of(said),
  });

  it('puts the first failure to a person, saying where it came from', () => {
    const failed = worked().failed(
      RUN_EXITED,
      failure('It exited 1.'),
      RUN,
      LINE,
    );

    expect(failed.awaitingReview).toBe(true);
    expect(failed.running).toBe(false);
    expect(failed.notes[0]?.kind).toBe('asked');
    expect(failed.notes[0]?.form).toBe('failure');
    expect(failed.notes[0]?.failure?.equals(RUN_EXITED)).toBe(true);
  });

  it('counts the same failure again while a person has not yet answered, rather than asking twice', () => {
    const failed = added()
      .failed(LOOPED, failure('Stopped a loop.'), null, LINE)
      .failed(LOOPED, failure('Stopped it again.'), null, LINE);

    expect(failed.notes).toHaveLength(1);
    expect(failed.notes[0]?.failure?.occurrences).toBe(2);
    expect(failed.notes[0]?.unread).toBe(true);
  });

  it('keeps a repeat in the conversation it belongs to once a person has answered', () => {
    const asked = worked().failed(
      RUN_EXITED,
      failure('It exited 1.'),
      RUN,
      LINE,
    );
    const answered = asked.answered(NotePosition.of(0), {
      ...saying,
      body: TaskNoteBody.of('Try again.'),
      voice: Voice.person(UserId.of('user_1')),
    });
    const again = answered
      .handedTo(RunId.of('run_2'), LINE)
      .failed(
        RUN_EXITED,
        failure('It exited 1 again.'),
        RunId.of('run_2'),
        LINE,
      );

    expect(again.openConversation?.from).toBe(0);
    expect(again.notes.map((each) => each.kind)).toEqual([
      'asked',
      'answered',
      'asked',
    ]);
    expect(again.notes[2]?.failure?.occurrences).toBe(2);
  });

  it('says a different failure in the open conversation rather than opening another', () => {
    const failed = added()
      .failed(LOOPED, failure('Stopped a loop.'), null, LINE)
      .failed(
        TaskFailure.fromHook('audit', 'loop'),
        failure('Stopped another.'),
        null,
        LINE,
      );

    expect(failed.notes.map((each) => each.kind)).toEqual(['asked', 'said']);
    expect(failed.openConversation?.from).toBe(0);
  });

  it('lets go of the run working it when the failure is not that run’s', () => {
    const failed = worked().failed(
      LOOPED,
      failure('Stopped a loop.'),
      null,
      LINE,
    );

    expect(failed.running).toBe(false);
    expect(failed.pullEvents().map((each) => each.kind)).toContain(
      'task.let-go-of-run',
    );
  });

  it('puts no failure on a finished task to anyone', () => {
    const finished = worked().finishedHere(RUN, LINE, saying);

    expect(finished.movedOnFrom(HERE)).toBe(true);
    expect(() =>
      finished.failed(LOOPED, failure('Stopped a loop.'), null, LINE),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('says each failure raised, where it was raised and how often it has repeated', () => {
    const failed = added()
      .failed(LOOPED, failure('Stopped a loop.'), null, LINE)
      .failed(LOOPED, failure('Stopped it again.'), null, LINE)
      .failed(RUN_EXITED, failure('It exited 1.'), null, LINE);

    expect(
      failed
        .pullEvents()
        .filter((each) => each instanceof TaskFailed)
        .map((each) => [
          each.stationId.value,
          each.failure.source,
          each.failure.code,
          each.failure.occurrences,
        ]),
    ).toEqual([
      [HERE.value, 'hook:notify', 'loop', 1],
      [HERE.value, 'hook:notify', 'loop', 2],
      [HERE.value, 'run', 'exited', 1],
    ]);
  });

  it('says which team’s line the failed task stands on', () => {
    const [raised] = worked()
      .failed(RUN_EXITED, failure('It exited 1.'), RUN, LINE)
      .pullEvents()
      .filter((each) => each instanceof TaskFailed);

    expect(raised?.teamId).toEqual(LINE.teamId);
  });

  it('tells no team of a failure raised while the task stands on no line', () => {
    expect(
      worked()
        .failed(RUN_EXITED, failure('It exited 1.'), RUN, null)
        .pullEvents()
        .filter((each) => each instanceof TaskFailed),
    ).toEqual([]);
  });

  it('leaves the task it failed from untouched, recording the failure only on the task it returns', () => {
    const task = worked();
    task.pullEvents();

    const failed = task.failed(RUN_EXITED, failure('It exited 1.'), RUN, LINE);

    expect(task.hasEvents).toBe(false);
    expect(
      failed.pullEvents().filter((each) => each instanceof TaskFailed),
    ).toHaveLength(1);
  });

  it('says which run raised a failure, and when', () => {
    const [raised] = worked()
      .failed(RUN_EXITED, failure('It exited 1.'), RUN, LINE)
      .pullEvents()
      .filter((each) => each instanceof TaskFailed);

    expect(raised?.by).toEqual(RUN);
    expect(raised?.at).toEqual(NOW);
  });

  it('says when it put the failure to a person', () => {
    const [asked] = worked()
      .failed(RUN_EXITED, failure('It exited 1.'), RUN, LINE)
      .pullEvents()
      .filter((each) => each instanceof TaskAsked);

    expect(asked?.at).toEqual(NOW);
  });

  it('knows it has moved on from a station it no longer stands at', () => {
    expect(added().movedOnFrom(HERE)).toBe(false);
    expect(added().movedOnFrom(StationId.of('station_2'))).toBe(true);
    expect(added().movedOnFrom(null)).toBe(false);
  });
});

describe('Task, its revision', () => {
  it('starts at the first revision and counts each move', () => {
    const moved = added().reactedTo(
      LINE,
      StationId.of('station_2'),
      TaskRank.of('i'),
      saying,
    );

    expect(added().revision.value).toBe(0);
    expect(moved.revision.value).toBe(1);
    expect(moved.standsAt(TaskRevision.of(1))).toBe(true);
  });

  it('counts being finished as a move', () => {
    expect(
      added().handedTo(RUN, LINE).finishedHere(RUN, LINE, saying).revision
        .value,
    ).toBe(1);
  });

  it('does not count what is said on it as a move', () => {
    expect(added().heard(saying).revision.value).toBe(0);
  });

  it('refuses what was decided on a revision it has moved on from', () => {
    expect(added().assertRevision(TaskRevision.of(0)).revision.value).toBe(0);
    expect(() => added().assertRevision(TaskRevision.of(1))).toThrow(
      StaleTaskRevisionError,
    );
    expect(() => TaskRevision.of(-1)).toThrow(InvalidTaskRevisionError);
  });
});

describe('Task and the happenings heard while a run holds it', () => {
  const world = { ...saying, voice: Voice.world() };
  const SPEC = StationId.of('station_2');
  const COMPLETED = StationId.of('completed_1');

  const held = () => {
    const task = added().handedTo(RUN, LINE);
    task.pullEvents();
    return task;
  };

  const letGo = (task: Task) =>
    task
      .pullEvents()
      .filter((each) => each.kind === 'task.let-go-of-run')
      .map((each) => (each as TaskLetGoOfRun).runId);

  it('refuses to be moved by a happening while a run holds it', () => {
    expect(() => held().reactedTo(LINE, SPEC, TaskRank.of('m'), world)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('is moved by a happening while no run holds it, letting go of nothing', () => {
    const moved = added().reactedTo(LINE, SPEC, TaskRank.of('m'), world);

    expect(moved.stationId).toEqual(SPEC);
    expect(letGo(moved)).toEqual([]);
  });

  it('holds a move back only while a run holds it, and never to where it stands', () => {
    expect(() => added().heldBack(LINE, SPEC, world)).toThrow(
      InvalidTaskTransitionError,
    );
    expect(() => held().heldBack(LINE, HERE, world)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  it('keeps the run and the station while a move is held back', () => {
    const noted = held().heldBack(LINE, SPEC, world);

    expect(noted.stationId).toEqual(HERE);
    expect(noted.currentRunId).toEqual(RUN);
    expect(noted.heldBackTo).toEqual(SPEC);
    expect(noted.pullEvents()).toEqual([]);
  });

  it('holds back only the latest move', () => {
    expect(
      held()
        .heldBack(LINE, StationId.of('station_0'), world)
        .heldBack(LINE, SPEC, world).heldBackTo,
    ).toEqual(SPEC);
  });

  it('holds nothing back once the run has passed it on, put it to a person, or a person moved it', () => {
    const noted = held().heldBack(LINE, SPEC, world);

    expect(
      noted.moveTo(LINE, StationId.of('station_0'), TaskRank.of('m'), saying, {
        mover: UserId.of('user_1'),
      }).heldBackTo,
    ).toBeNull();

    expect(noted.askedAbout(saying, RUN).heldBackTo).toBeNull();
    expect(
      noted.passedOn(RUN, LINE, SPEC, TaskRank.of('m'), saying).heldBackTo,
    ).toBeNull();
    expect(noted.heard(world).heldBackTo).toEqual(SPEC);
  });

  it('keeps a held-back move across a tool approval asked and granted while the run works', () => {
    const asked = held()
      .heldBack(LINE, SPEC, world)
      .clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
        ),
        ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
        { ...saying, voice: Voice.station(RUN) },
        RUN,
        null,
      ).task;

    expect(asked.heldBackTo).toEqual(SPEC);

    const granted = asked.answered(
      NotePosition.of(1),
      { ...saying, voice: Voice.person(UserId.of('user_1')) },
      'granted',
    );

    expect(granted.heldBackTo).toEqual(SPEC);
    expect(
      granted.movedAsHeldBack(
        RUN,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(Handover.done(TaskNoteBody.of('Done.'))),
      ).stationId,
    ).toEqual(SPEC);
  });

  it('stops its run and asks over a pending tool approval when interrupted, since the run would work on once approved', () => {
    const asking = held()
      .heldBack(LINE, SPEC, world)
      .clearFor(
        ApprovalSubject.toolCall(
          ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
        ),
        ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
        { ...saying, voice: Voice.station(RUN) },
        RUN,
        null,
      ).task;
    asking.pullEvents();

    expect(asking.awaitsAnAnswer).toBe(false);

    const interrupted = asking.interrupted(world);

    expect(interrupted.currentRunId).toBeNull();
    expect(letGo(interrupted)).toEqual([RUN]);
    expect(interrupted.notes.map((each) => each.kind)).toEqual([
      'said',
      'asked',
      'asked',
    ]);
    expect(interrupted.awaitingReview).toBe(true);
    expect(interrupted.owesADecision).toBe(false);
    expect(interrupted.heldBackTo).toBeNull();
  });

  it('refuses to hold back a move to the end of its line', () => {
    expect(() => held().heldBack(LINE, COMPLETED, world)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  const ending = (handover: Handover) => ({
    saying: { ...saying, voice: Voice.station(RUN) },
    handover,
  });

  it('is moved where a move was held back to by the run that held it, saying why and in the run’s own words', () => {
    const moved = held()
      .heldBack(LINE, SPEC, world)
      .movedAsHeldBack(
        RUN,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(
          Handover.review(
            TaskNoteBody.of('The run asked for someone to look at this.'),
            TaskNoteBody.of('Uploads retry now.'),
          ),
        ),
      );

    const [, spoken] = moved.notes;

    expect(moved.stationId).toEqual(SPEC);
    expect(moved.currentRunId).toBeNull();
    expect(spoken?.kind).toBe('passed');
    expect(spoken?.form).toBe('words');
    expect(spoken?.body.value).toBe(
      'Moved to Spec when the run ended. An event arrived while the run worked.\n\nUploads retry now.',
    );
  });

  it('keeps the failure of a run that failed when a held-back move takes the task on', () => {
    const failure = TaskFailure.fromRun('exited');
    const moved = held()
      .heldBack(LINE, SPEC, world)
      .movedAsHeldBack(
        RUN,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(
          Handover.failed(TaskNoteBody.of('The run failed: exit 1'), failure),
        ),
      );

    const [, spoken] = moved.notes;

    expect(spoken?.form).toBe('failure');
    expect(spoken?.failure).toEqual(failure);
    expect(spoken?.body.value).toContain('The run failed: exit 1');
  });

  it('says which run handed it on when a held-back move takes it on', () => {
    const handedOn = held()
      .heldBack(LINE, SPEC, world)
      .movedAsHeldBack(
        RUN,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(Handover.done(TaskNoteBody.of('Done.'))),
      )
      .pullEvents()
      .filter((each) => each instanceof TaskHandedOn);

    expect(handedOn).toEqual([
      new TaskHandedOn(added().id, added().workspaceId, RUN, HERE, SPEC, NOW),
    ]);
  });

  it('counts a failure that repeats one a person already answered when a held-back move takes the task on', () => {
    const exited = TaskFailure.fromRun('exited');
    const again = RunId.of('run_2');
    const answered = held()
      .failed(
        exited,
        { ...saying, body: TaskNoteBody.of('Exit 1.') },
        RUN,
        LINE,
      )
      .answered(NotePosition.of(0), {
        ...saying,
        body: TaskNoteBody.of('Try again.'),
        voice: Voice.person(UserId.of('user_1')),
      })
      .handedTo(again, LINE);
    answered.pullEvents();

    const moved = answered
      .heldBack(LINE, SPEC, world)
      .movedAsHeldBack(
        again,
        LINE,
        SPEC,
        TaskRank.of('m'),
        ending(Handover.failed(TaskNoteBody.of('Exit 1 again.'), exited)),
      );

    expect(
      moved
        .pullEvents()
        .filter((each) => each instanceof TaskFailed)
        .map((each) => each.failure.occurrences),
    ).toEqual([2]);
    expect(moved.notes[moved.notes.length - 1]?.failure?.occurrences).toBe(2);
  });

  it('is moved for a held-back move only by the run that holds it, and only to where the move was held back to', () => {
    const noted = held().heldBack(LINE, SPEC, world);
    const review = ending(Handover.review(TaskNoteBody.of('Look.')));

    expect(() =>
      noted.movedAsHeldBack(
        RunId.of('run_9'),
        LINE,
        SPEC,
        TaskRank.of('m'),
        review,
      ),
    ).toThrow(InvalidTaskTransitionError);
    expect(() =>
      noted.movedAsHeldBack(RUN, LINE, COMPLETED, TaskRank.of('m'), review),
    ).toThrow(InvalidTaskTransitionError);
    expect(() =>
      held().movedAsHeldBack(RUN, LINE, SPEC, TaskRank.of('m'), review),
    ).toThrow(InvalidTaskTransitionError);
  });

  it('lets go of the run and puts itself to a person when interrupted', () => {
    const interrupted = held().interrupted(world);

    expect(interrupted.stationId).toEqual(HERE);
    expect(interrupted.currentRunId).toBeNull();
    expect(interrupted.awaitingReview).toBe(true);
    expect(interrupted.assignee).toEqual(UserId.of('user_1'));
    expect(letGo(interrupted)).toEqual([RUN]);
  });

  it('is interrupted only while a run holds it', () => {
    expect(() => added().interrupted(world)).toThrow(
      InvalidTaskTransitionError,
    );
  });

  describe('while its run waits on a person', () => {
    const paused = () => {
      const task = held().putToAPersonBy(RUN, {
        ...saying,
        voice: Voice.station(RUN),
      });
      task.pullEvents();
      return task;
    };

    it('holds a move back, keeping the run and the question', () => {
      const noted = paused().heldBack(LINE, SPEC, world);

      expect(noted.stationId).toEqual(HERE);
      expect(noted.currentRunId).toEqual(RUN);
      expect(noted.awaitingReview).toBe(true);
      expect(noted.openConversation).toEqual({ from: 0, to: null });
      expect(noted.heldBackTo).toEqual(SPEC);
      expect(noted.pullEvents()).toEqual([]);
    });

    it('refuses to be moved by a happening', () => {
      expect(() =>
        paused().reactedTo(LINE, SPEC, TaskRank.of('m'), world),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('adds an interruption to the open question without asking again, leaving its run alone', () => {
      const interrupted = paused().interrupted(world);

      expect(interrupted.currentRunId).toEqual(RUN);
      expect(interrupted.awaitingReview).toBe(true);
      expect(interrupted.notes.map((each) => each.kind)).toEqual([
        'asked',
        'said',
      ]);
      expect(interrupted.openConversation).toEqual({ from: 0, to: null });
      expect(interrupted.pullEvents()).toEqual([]);
    });

    it('drops the moves held back before an interruption, leaving the person to decide', () => {
      const interrupted = paused()
        .heldBack(LINE, SPEC, world)
        .interrupted(world);

      expect(interrupted.heldBackTo).toBeNull();
      expect(interrupted.notes[2]?.heldBack?.clears).toBe(true);
    });

    it('is moved where a move was held back to once its run ends without passing it on', () => {
      const moved = paused()
        .heldBack(LINE, SPEC, world)
        .movedAsHeldBack(
          RUN,
          LINE,
          SPEC,
          TaskRank.of('m'),
          ending(Handover.review(TaskNoteBody.of('Stopped.'))),
        );

      expect(moved.stationId).toEqual(SPEC);
      expect(moved.currentRunId).toBeNull();
      expect(moved.awaitingReview).toBe(false);
    });
  });

  describe('once interrupted', () => {
    const person = { ...saying, voice: Voice.person(UserId.of('user_1')) };

    it('takes a word in the run chat as the answer, wanting a run at its station again', () => {
      const spoken = held().interrupted(world).spokenTo(RUN, person, HERE);

      expect(spoken.awaitingReview).toBe(false);
      expect(spoken.notes.map((each) => each.kind)).toEqual([
        'asked',
        'answered',
      ]);
      expect(spoken.wantsRun(LINE)).toBe(true);
    });

    it('will not take a word from the chat of a run at a station it has left', () => {
      expect(() =>
        held().interrupted(world).spokenTo(RUN, person, SPEC),
      ).toThrow(InvalidTaskTransitionError);
    });
  });
});
