import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  TaskNote,
  type TaskNoteForm,
  type TaskNoteKind,
} from '@work/domain/entities/task-note.entity';
import {
  configuredBy,
  openSetupList,
  SETUP_STEPS,
  type SetupState,
  setupChatOf,
  setupDoneNote,
  TAKEN,
} from '@work/domain/services/setup-list';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
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

const LINE = deliveryLineOf({
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  newId: (() => {
    let next = 0;
    return () => `id_${++next}`;
  })(),
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

  it('says so on the line the task is on', () => {
    const newNote = setupDoneNote(
      [note('asked', 'setup', 'Backlog')],
      done,
      NOW,
      LINE,
    );

    expect(newNote?.line).toBe(LINE);
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
  it('is configured once its setup chat opened a pull request', () => {
    expect(
      configuredBy({ pullRequest: 'https://x/1', startedAt: new Date(0) }),
    ).toBe(true);
    expect(configuredBy({ pullRequest: null, startedAt: new Date(0) })).toBe(
      false,
    );
    expect(configuredBy(null)).toBe(false);
  });
});

describe("the team's setup chat", () => {
  const chat = (id: string, day: number, pullRequest: string | null) => ({
    id,
    pullRequest,
    startedAt: new Date(`2026-10-0${day}T09:00:00.000Z`),
  });

  it('is the newest chat that opened its pull request', () => {
    expect(
      setupChatOf([
        chat('newest', 3, null),
        chat('opened', 2, 'https://github.com/acme/infra/pull/2'),
        chat('opened-first', 1, 'https://github.com/acme/infra/pull/1'),
      ])?.id,
    ).toBe('opened');
  });

  it('is the newest chat while none opened a pull request', () => {
    expect(
      setupChatOf([chat('older', 1, null), chat('newer', 2, null)])?.id,
    ).toBe('newer');
  });

  it('is none for a team that started no setup chat', () => {
    expect(setupChatOf([])).toBeNull();
  });
});
