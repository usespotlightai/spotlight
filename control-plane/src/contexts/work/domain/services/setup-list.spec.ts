import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import {
  TaskNote,
  type TaskNoteForm,
  type TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import {
  configuredBy,
  mayStartSetup,
  openSetupList,
  SETUP_STEPS,
  type SetupState,
  setupDoneNote,
  TAKEN,
} from '@work/domain/services/setup-list';
import { stationOf } from '@work/domain/value-objects/line-map.fake-spec';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const done: SetupState = {
  connectedToGitHub: true,
  hasHarness: true,
  configured: true,
};

const nothing: SetupState = {
  connectedToGitHub: false,
  hasHarness: false,
  configured: false,
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
    stationId: StationId.of(station),
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
      expect(
        setupDoneNote([note('asked', 'setup')], missing, NOW, null),
      ).toBeNull();
    },
  );

  it('is done when every step has been taken', () => {
    expect(
      setupDoneNote([note('asked', 'setup')], done, NOW, null),
    ).not.toBeNull();
  });

  it('is done by nothing at all where nothing has been', () => {
    expect(SETUP_STEPS.some((step) => TAKEN[step](nothing))).toBe(false);
  });
});

describe('setupDoneNote', () => {
  it('closes an open list with nothing left on it', () => {
    const newNote = setupDoneNote([note('asked', 'setup')], done, NOW, null);

    expect(newNote?.body).toEqual(
      TaskNoteBody.of('Everything on this list is done.'),
    );
    expect(newNote?.voice.isStation).toBe(true);
    expect(newNote?.at).toBe(NOW);
  });

  it('says so at the station the task is at', () => {
    const backlog = stationOf({
      id: StationId.of('station_backlog'),
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      position: 0,
      kind: 'backlog',
    });
    const newNote = setupDoneNote(
      [note('asked', 'setup', 'Backlog')],
      done,
      NOW,
      backlog,
    );

    expect(newNote?.station).toBe(backlog);
  });

  it('closes nothing while a step is still to be taken', () => {
    expect(
      setupDoneNote([note('asked', 'setup')], nothing, NOW, null),
    ).toBeNull();
  });

  it('still closes one somebody has answered', () => {
    expect(
      setupDoneNote(
        [note('asked', 'setup'), note('answered')],
        done,
        NOW,
        null,
      ),
    ).not.toBeNull();
  });

  it('closes nothing a conversation closed already', () => {
    expect(
      setupDoneNote([note('asked', 'setup'), note('passed')], done, NOW, null),
    ).toBeNull();
  });

  it('closes nothing on a task that never had a list', () => {
    expect(setupDoneNote([note('asked')], done, NOW, null)).toBeNull();
  });

  it('closes nothing where what is open is not the list', () => {
    expect(
      setupDoneNote(
        [note('asked', 'setup'), note('passed'), note('asked')],
        done,
        NOW,
        null,
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

describe('starting and finishing setup', () => {
  const state = (connectedToGitHub: boolean) => ({
    connectedToGitHub,
    hasHarness: true,
    configured: false,
  });

  it('may start once GitHub is connected and a runner can reach out through egress', () => {
    expect(mayStartSetup(state(true), true)).toBe(true);
    expect(mayStartSetup(state(false), true)).toBe(false);
    expect(mayStartSetup(state(true), false)).toBe(false);
  });

  it('is configured once its setup chat opened a pull request', () => {
    expect(configuredBy({ pullRequest: 'https://x/1' })).toBe(true);
    expect(configuredBy({ pullRequest: null })).toBe(false);
    expect(configuredBy(null)).toBe(false);
  });
});
