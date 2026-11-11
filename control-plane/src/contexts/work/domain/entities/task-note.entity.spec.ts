import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { DeferredMove } from '@work/domain/value-objects/deferred-move.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { TaskFailure } from '@work/domain/value-objects/task-failure.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-08-31T10:00:00.000Z');

const aNote = (over: Record<string, unknown> = {}) =>
  TaskNote.of({
    position: NotePosition.of(0),
    voice: Voice.station(),
    station: StationName.of('Triage'),
    stationId: StationId.of('station_triage'),
    body: TaskNoteBody.of('Reproduced on restart.'),
    at: NOW,
    kind: 'passed',
    ...over,
  });

const line = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationOf({
      id: StationId.of('station_backlog'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      kind: 'backlog',
    }),
    stationOf({
      id: StationId.of('station_build'),
      key: StationKey.of('build'),
      name: StationName.of('Build'),
      position: 1,
    }),
    stationOf({
      id: StationId.of('station_done'),
      key: StationKey.of('shipped'),
      name: StationName.of('Done'),
      position: 2,
      kind: 'completed',
    }),
  ],
});

describe('TaskNote', () => {
  it('is the same note wherever it is in the trail, however it has changed', () => {
    const note = aNote({ kind: 'asked' });

    expect(note.read(NOW).equals(note)).toBe(true);
    expect(note.equals(aNote({ position: NotePosition.of(1) }))).toBe(false);
  });

  it('carries who wrote it, whole', () => {
    const note = aNote({ voice: Voice.person(UserId.of('user_1')) });

    expect(note.voice.isPerson).toBe(true);
    expect(note.voice.author?.value).toBe('user_1');
  });

  it('waits to be acknowledged where it is a message', () => {
    expect(
      aNote({ kind: 'message', voice: Voice.world() }).unacknowledged,
    ).toBe(true);
    expect(aNote({ kind: 'passed' }).unacknowledged).toBe(false);
  });

  it('is acknowledged once, and stays so', () => {
    const handed = aNote({ kind: 'message', voice: Voice.world() }).acknowledge(
      NOW,
    );

    expect(handed.unacknowledged).toBe(false);
    expect(handed.acknowledge(new Date()).acknowledgedAt).toEqual(NOW);
  });

  it('is unread only while a person has been asked something', () => {
    expect(aNote({ kind: 'asked' }).unread).toBe(true);
    expect(aNote({ kind: 'asked' }).read(NOW).unread).toBe(false);
    expect(aNote({ kind: 'passed' }).unread).toBe(false);
  });

  it('carries a failure, approval or connection only in the form that holds it', () => {
    expect(() =>
      aNote({ form: 'words', failure: TaskFailure.fromRun('exited') }),
    ).toThrow(InconsistentStateError);
    expect(
      aNote({ form: 'failure', failure: TaskFailure.fromRun('exited') })
        .failure,
    ).not.toBeNull();
  });

  it('holds the payload its form names', () => {
    expect(() => aNote({ form: 'failure' })).toThrow(InconsistentStateError);
    expect(() => aNote({ form: 'connection' })).toThrow(InconsistentStateError);
    expect(() => aNote({ kind: 'asked', form: 'approval' })).toThrow(
      InconsistentStateError,
    );
  });

  it('records a decision only on an answer', () => {
    expect(() => aNote({ kind: 'asked', form: 'decision' })).toThrow(
      InconsistentStateError,
    );
    expect(aNote({ kind: 'answered', form: 'decision' }).form).toBe('decision');
  });

  it('defers a move only on a message', () => {
    expect(() =>
      aNote({
        kind: 'passed',
        deferredMove: DeferredMove.moveTo(StationId.of('station_build')),
      }),
    ).toThrow(InconsistentStateError);
  });

  it('tells a run where the task moves when a deferred move waits', () => {
    const deferred = aNote({
      kind: 'message',
      voice: Voice.world(),
      body: TaskNoteBody.of('The checks failed.'),
      deferredMove: DeferredMove.moveTo(StationId.of('station_build')),
    });

    expect(deferred.toldOn(line).value).toBe(
      TaskNoteBody.deferredMove(
        StationName.of('Build'),
        TaskNoteBody.of('The checks failed.'),
      ).value,
    );
  });

  it('tells a run only what came in where no move waits, or its station is gone', () => {
    const gone = aNote({
      kind: 'message',
      voice: Voice.world(),
      deferredMove: DeferredMove.moveTo(StationId.of('station_gone')),
    });

    expect(aNote().toldOn(line).value).toBe('Reproduced on restart.');
    expect(gone.toldOn(line).value).toBe('Reproduced on restart.');
    expect(gone.toldOn(null).value).toBe('Reproduced on restart.');
  });
});
