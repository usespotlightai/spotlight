import { Task } from '@domain/aggregates/task.aggregate';
import { InvalidTaskTransitionError } from '@domain/exceptions/invalid-task-transition.error';
import { HarnessSession } from '@domain/value-objects/harness-session.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { TaskNote } from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const added = (description?: TaskDescription) =>
  Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of('station_1'),
    title: TaskTitle.of('Fix the queue'),
    description,
    rank: TaskRank.of('i'),
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
    const worked = added().note(
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
    const worked = added()
      .note(
        TaskNote.of({
          station: StationName.of('Triage'),
          body: TaskNoteBody.of('First'),
          at: new Date('2026-08-28T10:00:00.000Z'),
        }),
      )
      .note(
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
  // down — and it is what closes a stretch a person was owed.
  it('carries what was said across a move, and records the move', () => {
    const worked = added()
      .note(
        TaskNote.of({
          station: StationName.of('Triage'),
          body: TaskNoteBody.of('Reproduced.'),
          at: new Date('2026-08-28T10:00:00.000Z'),
        }),
      )
      .moveTo(StationId.of('station_2'), TaskRank.of('m'), saying);

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
        .answered(saying);

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

  describe('what a person is owed', () => {
    // The task says what each note did, so nothing outside it can write a
    // note that means something the task never did.
    it('owes nobody until it is put to someone', () => {
      expect(added().owed).toBeNull();
    });

    it('owes an ending once it has been put to someone', () => {
      expect(added().askedAbout(saying).owed).toEqual({ from: 0, to: null });
    });

    it('still owes it after an answer', () => {
      const asked = added().askedAbout(saying).answered(saying);

      expect(asked.owed).not.toBeNull();
    });

    it('owes nothing once it has moved on', () => {
      const passed = added()
        .askedAbout(saying)
        .passedTo(StationId.of('station_2'), TaskRank.of('m'), saying);

      expect(passed.owed).toBeNull();
    });

    it('refuses an answer to something nobody was asked', () => {
      expect(() => added().answered(saying)).toThrow(
        InvalidTaskTransitionError,
      );
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

    it('will not be moved to the station it already stands at', () => {
      expect(() =>
        added().moveTo(StationId.of('station_1'), TaskRank.of('m'), saying),
      ).toThrow(InvalidTaskTransitionError);
    });
  });
});
