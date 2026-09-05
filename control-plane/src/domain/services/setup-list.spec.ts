import {
  SETUP_STEPS,
  type SetupState,
  settling,
  TAKEN,
} from '@domain/services/setup-list';
import { StationName } from '@domain/value-objects/station-name.vo';
import {
  TaskNote,
  type TaskNoteForm,
  type TaskNoteKind,
} from '@domain/value-objects/task-note.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const done: SetupState = {
  hasRunner: true,
  connectedToGitHub: true,
  hasRepository: true,
  hasConfiguration: true,
  listensToATool: true,
};

const nothing: SetupState = {
  hasRunner: false,
  connectedToGitHub: false,
  hasRepository: false,
  hasConfiguration: false,
  listensToATool: false,
};

const NOW = new Date('2026-01-02T03:04:05.000Z');

const note = (
  kind: TaskNoteKind,
  form: TaskNoteForm = 'words',
  station = 'Backlog',
): TaskNote =>
  TaskNote.of({
    station: StationName.of(station),
    body: TaskNoteBody.of('anything'),
    at: NOW,
    voice: Voice.station(),
    kind,
    form,
  });

describe('the setup list', () => {
  // A step waiting on nothing of its own is one nobody can ever tick off.
  it.each(Object.keys(done) as (keyof SetupState)[])(
    'has one step and only one waiting on %s',
    (fact) => {
      const missing = { ...done, [fact]: false };

      expect(SETUP_STEPS.filter((step) => TAKEN[step](missing))).toHaveLength(
        SETUP_STEPS.length - 1,
      );
      expect(settling([note('asked', 'setup')], missing, NOW)).toBeNull();
    },
  );

  it('is done when every step has been taken', () => {
    expect(settling([note('asked', 'setup')], done, NOW)).not.toBeNull();
  });

  it('is done by nothing at all where nothing has been', () => {
    expect(SETUP_STEPS.some((step) => TAKEN[step](nothing))).toBe(false);
  });
});

describe('settling', () => {
  it('settles a standing list with nothing left on it', () => {
    const saying = settling([note('asked', 'setup')], done, NOW);

    expect(saying?.body).toEqual(
      TaskNoteBody.of('Everything on this list is done.'),
    );
    expect(saying?.voice.isStation).toBe(true);
    expect(saying?.at).toBe(NOW);
  });

  it('says so at the station the list was raised at', () => {
    const saying = settling([note('asked', 'setup', 'Backlog')], done, NOW);

    expect(saying?.station).toEqual(StationName.of('Backlog'));
  });

  it('settles nothing while a step is still to be taken', () => {
    expect(settling([note('asked', 'setup')], nothing, NOW)).toBeNull();
  });

  // Answering does not close it.
  it('still settles one somebody has answered', () => {
    expect(
      settling([note('asked', 'setup'), note('answered')], done, NOW),
    ).not.toBeNull();
  });

  it('settles nothing a conversation closed already', () => {
    expect(
      settling([note('asked', 'setup'), note('passed')], done, NOW),
    ).toBeNull();
  });

  it('settles nothing on a task that never held a list', () => {
    expect(settling([note('asked')], done, NOW)).toBeNull();
  });

  // What is open now is somebody else's conversation.
  it('settles nothing where what is open is not the list', () => {
    expect(
      settling(
        [note('asked', 'setup'), note('passed'), note('asked')],
        done,
        NOW,
      ),
    ).toBeNull();
  });
});
