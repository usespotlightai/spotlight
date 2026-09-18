import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import type { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { NoRepositoryError } from '@work/domain/exceptions/no-repository.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
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
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

const withNotes = (task: Task, ...notes: TaskNote[]) =>
  Task.rehydrate({
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
    const moved = added().moveTo(
      LINE,
      StationId.of('station_2'),
      TaskRank.of('m'),
      saying,
    );

    expect(moved.stationId).toEqual(StationId.of('station_2'));
  });

  it('keeps everything else across a move', () => {
    const moved = added(TaskDescription.of('## Steps')).moveTo(
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
    task.moveTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

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
    ).moveTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

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
        .moveTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(passed.sessionId).toBeNull();
      expect(passed.runnerId).toBeNull();
    });

    it('is left behind when the task is moved by hand', () => {
      const moved = added()
        .workedIn(session, runner)
        .moveTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(moved.sessionId).toBeNull();
      expect(moved.runnerId).toBeNull();
    });

    it('names the directory the next run here should work in', () => {
      expect(added().continuity().key.value).toBe('task_1-station_1');
    });

    it('hands the conversation and the runner to the next run', () => {
      const carried = added().workedIn(session, runner).continuity();

      expect(carried.sessionId).toEqual(session);
      expect(carried.pinnedTo).toEqual(runner);
    });

    it('pins nothing when there is no conversation to return to', () => {
      expect(added().continuity().pinnedTo).toBeNull();
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
        .moveTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

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
        .moveTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying);

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
      const moved = added().moveTo(
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
          .moveTo(LINE, StationId.of('completed_1'), TaskRank.of('m'), saying)
          .handedTo(RUN, LINE),
      ).toThrow(InvalidTaskTransitionError);
      expect(() =>
        added()
          .moveTo(LINE, StationId.of('station_0'), TaskRank.of('m'), saying)
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
        added().moveTo(
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
        .moveTo(LINE, StationId.of('station_2'), TaskRank.of('m'), saying)
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
        added().moveTo(
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
      const landed = added().moveTo(
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
            StationId.of('station_2'),
            TaskRank.of('m'),
            saying,
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
          added().moveTo(
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
      expect(() => added().openedAt(RUN, url)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(() =>
        added().handedTo(RUN, LINE).openedAt(RunId.of('run_2'), url),
      ).toThrow(InvalidTaskTransitionError);
      expect(
        added().handedTo(RUN, LINE).openedAt(RUN, url).pullRequest,
      ).toEqual(url);
    });
  });

  describe('reviewing a pull request', () => {
    const url = PullRequestUrl.of('https://github.com/acme/widgets/pull/7');

    it('wears the pull request, and reviews it rather than owning it', () => {
      const reviewing = added().reviews(url);

      expect(reviewing.pullRequest).toEqual(url);
      expect(reviewing.reviewing).toBe(true);
      expect(reviewing.reviewed?.value).toBe('acme/widgets');
      expect(reviewing.marks.map(String)).toEqual([
        `github.review:${url.value}`,
      ]);
    });

    it('reviews nothing once it has a pull request of its own', () => {
      const own = added().handedTo(RUN, LINE).openedAt(RUN, url);

      expect(own.reviewing).toBe(false);
      expect(own.reviewed).toBeNull();
      expect(() => own.reviews(url)).toThrow(InvalidTaskTransitionError);
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
        added().moveTo(
          ELSEWHERE,
          ELSEWHERE.backlog.id,
          TaskRank.of('m'),
          saying,
        ),
      ).toThrow(UnknownStationError);
    });

    it('will not be moved to a station off its line', () => {
      expect(() =>
        added().moveTo(LINE, ELSEWHERE.backlog.id, TaskRank.of('m'), saying),
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

    it('is not taken up when moved by hand between worked stations', () => {
      const worked = inBacklog().moveTo(
        LINE,
        StationId.of('station_1'),
        TaskRank.of('m'),
        saying,
      );

      expect(
        worked.moveTo(
          LINE,
          StationId.of('station_2'),
          TaskRank.of('m'),
          saying,
          mover,
        ).assignee,
      ).toBeNull();
    });

    it('is not taken up when it leaves the backlog without a hand to move it', () => {
      expect(
        inBacklog().moveTo(
          LINE,
          StationId.of('station_1'),
          TaskRank.of('m'),
          saying,
        ).assignee,
      ).toBeNull();
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
          .moveTo(LINE, StationId.of('completed_1'), TaskRank.of('m'), saying)
          .wantsRun(LINE),
      ).toBe(false);
    });

    it('wants none where nothing runs', () => {
      expect(
        added()
          .moveTo(LINE, StationId.of('station_0'), TaskRank.of('m'), saying)
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
});
