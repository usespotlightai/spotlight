import {
  TaskNote,
  type TaskNoteForm,
  type TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import {
  openSetupList,
  SETUP_STEPS,
  type SetupState,
  settling,
  TAKEN,
} from '@work/domain/services/setup-list';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const done: SetupState = {
  hasRunner: true,
  connectedToGitHub: true,
  hasRepository: true,
  hasConfiguration: true,
  listensToAnIntegration: true,
};

const nothing: SetupState = {
  hasRunner: false,
  connectedToGitHub: false,
  hasRepository: false,
  hasConfiguration: false,
  listensToAnIntegration: false,
};

const NOW = new Date('2026-01-02T03:04:05.000Z');

const note = (
  kind: TaskNoteKind,
  form: TaskNoteForm = 'words',
  station = 'Backlog',
): TaskNote =>
  TaskNote.of({
    position: NotePosition.of(0),
    station: StationName.of(station),
    body: TaskNoteBody.of('anything'),
    at: NOW,
    voice: Voice.station(),
    kind,
    form,
  });

describe('the setup list', () => {
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

describe('an open setup list', () => {
  it('is the note that opened the conversation still open, where it opened as the list', () => {
    const list = note('asked', 'setup');

    expect(openSetupList([list, note('answered')])).toBe(list);
  });

  it('is none once the conversation it opened is passed on', () => {
    expect(openSetupList([note('asked', 'setup'), note('passed')])).toBeNull();
  });

  it('is none where a list was put to someone inside a conversation it did not open', () => {
    expect(
      openSetupList([note('asked'), note('answered'), note('asked', 'setup')]),
    ).toBeNull();
  });
});
