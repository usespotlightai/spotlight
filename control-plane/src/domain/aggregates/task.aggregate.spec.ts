import { Task } from '@domain/aggregates/task.aggregate';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
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
    const moved = added().moveTo(StationId.of('station_2'), TaskRank.of('m'));

    expect(moved.stationId).toEqual(StationId.of('station_2'));
  });

  it('keeps everything else across a move', () => {
    const moved = added(TaskDescription.of('## Steps')).moveTo(
      StationId.of('station_2'),
      TaskRank.of('m'),
    );

    expect(moved.id.value).toBe('task_1');
    expect(moved.title.value).toBe('Fix the queue');
    expect(moved.description?.value).toBe('## Steps');
  });

  it('leaves the task it was moved from where it stood', () => {
    const task = added();
    task.moveTo(StationId.of('station_2'), TaskRank.of('m'));

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

  it('carries its notes across a move', () => {
    const worked = added()
      .note(
        TaskNote.of({
          station: StationName.of('Triage'),
          body: TaskNoteBody.of('Reproduced.'),
          at: new Date('2026-08-28T10:00:00.000Z'),
        }),
      )
      .moveTo(StationId.of('station_2'), TaskRank.of('m'));

    expect(worked.notes).toHaveLength(1);
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
});
