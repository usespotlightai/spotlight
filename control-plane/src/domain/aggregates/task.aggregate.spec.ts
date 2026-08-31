import { Task } from '@domain/aggregates/task.aggregate';
import { InvalidTaskTransitionError } from '@domain/exceptions/invalid-task-transition.error';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { NotePosition } from '@domain/value-objects/note-position.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

// A task carrying a trail, built the way the repository builds one: the
// aggregate writes its own notes, so nothing may hand it any.
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
    notes: [...task.notes, ...notes],
    createdAt: task.createdAt,
    raisedAt: task.raisedAt,
    raisedBy: task.raisedBy,
    repository: task.repository,
    pullRequest: task.pullRequest,
  });

const added = (description?: TaskDescription) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    description,
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: new Date('2026-08-27T09:15:00.000Z'),
    newId: () => 'task_1',
  });

const NOW = new Date('2026-08-29T12:00:00.000Z');

const saying = {
  station: StationName.of('Triage'),
  body: TaskNoteBody.of('Reproduced on restart.'),
  at: NOW,
};

describe('Task', () => {
  it('stands at the station it was added to', () => {
    expect(added().stationId).toEqual(StationId.of('station_1'));
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
      StationId.of('station_2'),
      TaskRank.of('m'),
      saying,
    );

    expect(moved.stationId).toEqual(StationId.of('station_2'));
  });

  it('keeps everything else across a move', () => {
    const moved = added(TaskDescription.of('## Steps')).moveTo(
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
    task.moveTo(StationId.of('station_2'), TaskRank.of('m'), saying);

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
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Reproduced on restart.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
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
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('First'),
        at: new Date('2026-08-28T10:00:00.000Z'),
      }),
      TaskNote.of({
        station: StationName.of('Spec'),
        body: TaskNoteBody.of('Second'),
        at: new Date('2026-08-28T11:00:00.000Z'),
      }),
    );

    expect(worked.notes.map((each) => each.station.value)).toEqual([
      'Triage',
      'Spec',
    ]);
  });

  // Moving by hand is something that happened to the task, so it is written
  // down — and it is what closes a conversation a person was owed.
  it('carries what was said across a move, and records the move', () => {
    const worked = withNotes(
      added(),
      TaskNote.of({
        station: StationName.of('Triage'),
        body: TaskNoteBody.of('Reproduced.'),
        at: new Date('2026-08-28T10:00:00.000Z'),
      }),
    ).moveTo(StationId.of('station_2'), TaskRank.of('m'), saying);

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
      workspaceId: WorkspaceId.of('ws_1'),
      stationId: StationId.of('station_1'),
      title: TaskTitle.of('Fix the queue'),
      rank: TaskRank.of('i'),
      raisedBy: UserId.of('user_1'),
      now: new Date('2026-08-28T12:00:00.000Z'),
      newId: () => 'task_1',
    });

  const asked = () =>
    TaskNote.of({
      station: StationName.of('Triage'),
      body: TaskNoteBody.of('Which queue did you mean?'),
      at: new Date('2026-08-28T12:00:00.000Z'),
    });

  it('is idle when nobody has taken it up', () => {
    const task = raised();

    expect(task.running).toBe(false);
    expect(task.idle).toBe(true);
  });

  it('is not idle while a run holds it', () => {
    const task = raised().handedTo(RunId.of('run_1'));

    expect(task.running).toBe(true);
    expect(task.idle).toBe(false);
  });

  // Waiting on a person is not idle either: taking it up again would talk
  // over them.
  it('is not idle while it waits on a person', () => {
    const task = raised().askedAbout(asked());

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

    // The inbox round trip is the whole point: a person answers and the work
    // picks up mid-thought rather than beginning again.
    it('survives being put to a person', () => {
      const asked = added().workedIn(session, runner).askedAbout(saying);

      expect(asked.sessionId).toEqual(session);
      expect(asked.runnerId).toEqual(runner);
      expect(asked.awaitingReview).toBe(true);
    });

    // What the next station inherits is the note. Carrying the conversation
    // would make the note decoration.
    it('is left behind when the task is passed on', () => {
      const passed = added()
        .workedIn(session, runner)
        .passedTo(StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(passed.sessionId).toBeNull();
      expect(passed.runnerId).toBeNull();
    });

    it('is left behind when the task is moved by hand', () => {
      const moved = added()
        .workedIn(session, runner)
        .moveTo(StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(moved.sessionId).toBeNull();
      expect(moved.runnerId).toBeNull();
    });

    it('names the directory the next run here should work in', () => {
      expect(added().continuity().key).toBe('task_1-station_1');
    });

    it('hands the conversation and the runner to the next run', () => {
      const carried = added().workedIn(session, runner).continuity();

      expect(carried.sessionId).toEqual(session);
      expect(carried.pinnedTo).toEqual(runner);
    });

    // Nothing to go back for, so anything may take it and the queue stays even.
    it('pins nothing when there is no conversation to return to', () => {
      expect(added().continuity().pinnedTo).toBeNull();
    });

    // What makes the inbox round trip work: the answer leaves the task where
    // it is, so the run that follows takes up the same conversation.
    it('survives a person answering what it was waiting on', () => {
      const answered = added()
        .workedIn(session, runner)
        .askedAbout(saying)
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

  // Read from the trail, so nothing can say it is waiting on a person when
  // the trail says they already answered.
  describe('waiting on a person', () => {
    it('waits from the asking until they answer', () => {
      const asked = added().askedAbout(saying);

      expect(asked.awaitingReview).toBe(true);
      expect(asked.answered(NotePosition.of(0), saying).awaitingReview).toBe(
        false,
      );
    });

    it('stops waiting once the task is moved by hand', () => {
      const moved = added()
        .askedAbout(saying)
        .moveTo(StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(moved.awaitingReview).toBe(false);
    });
  });

  describe('what a person is owed', () => {
    // The task says what each note did, so nothing outside it can write a
    // note that means something the task never did.
    it('owes nobody until it is put to someone', () => {
      expect(added().openConversation).toBeNull();
    });

    it('owes an ending once it has been put to someone', () => {
      expect(added().askedAbout(saying).openConversation).toEqual({
        from: 0,
        to: null,
      });
    });

    it('still owes it after an answer', () => {
      const asked = added()
        .askedAbout(saying)
        .answered(NotePosition.of(0), saying);

      expect(asked.openConversation).not.toBeNull();
    });

    it('owes nothing once it has moved on', () => {
      const passed = added()
        .askedAbout(saying)
        .passedTo(StationId.of('station_2'), TaskRank.of('m'), saying);

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
  });

  describe('reading what was put to a person', () => {
    const READ = new Date('2026-08-29T12:30:00.000Z');
    const asked = () => added().askedAbout(saying);

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
          author: UserId.of('user_1'),
        })
        .askedAbout(saying)
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
          author: UserId.of('user_1'),
        })
        .askedAbout(saying);

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

    it('joins the trail where the task still stands', () => {
      const told = added().told(here, saying);

      expect(told.notes[0]?.kind).toBe('said');
      expect(told.notes[0]?.body.value).toBe('Reproduced on restart.');
    });

    it('waits to be delivered', () => {
      expect(added().told(here, saying).undelivered).toHaveLength(1);
    });

    it('is delivered once the agent has been given it', () => {
      const told = added()
        .told(here, saying)
        .deliveredUpTo(NotePosition.of(0), NOW);

      expect(told.undelivered).toHaveLength(0);
    });

    it('will not be said to a station the task has left', () => {
      const moved = added().passedTo(
        StationId.of('station_2'),
        TaskRank.of('m'),
        saying,
      );

      expect(() => moved.told(here, saying)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    // Only what a person said to an agent ever waits to be handed over.
    it('leaves what a station said out of what is undelivered', () => {
      expect(added().askedAbout(saying).undelivered).toHaveLength(0);
    });
  });

  describe('what it refuses', () => {
    // Every one of these was a rule living in a handler, or nowhere.
    it('will not be put to a person twice over', () => {
      expect(() => added().askedAbout(saying).askedAbout(saying)).toThrow(
        InvalidTaskTransitionError,
      );
    });

    it('will not be taken up by a second run while one holds it', () => {
      expect(() =>
        added().handedTo(RunId.of('run_1')).handedTo(RunId.of('run_2')),
      ).toThrow(InvalidTaskTransitionError);
    });

    // Handing it back where it stands moves nothing and starts the same work
    // again, which is a loop rather than progress.
    it('will not be passed to the station it already stands at', () => {
      expect(() =>
        added().passedTo(StationId.of('station_1'), TaskRank.of('m'), saying),
      ).toThrow(InvalidTaskTransitionError);
    });

    it('will not answer a conversation that has already closed', () => {
      const carried = added()
        .askedAbout(saying)
        .passedTo(StationId.of('station_2'), TaskRank.of('m'), saying)
        .askedAbout(saying);

      expect(() => carried.answered(NotePosition.of(0), saying)).toThrow(
        InvalidTaskTransitionError,
      );
      expect(carried.answered(NotePosition.of(2), saying).notes).toHaveLength(
        4,
      );
    });

    it('will not be moved to the station it already stands at', () => {
      expect(() =>
        added().moveTo(StationId.of('station_1'), TaskRank.of('m'), saying),
      ).toThrow(InvalidTaskTransitionError);
    });
  });
});
