import { Said } from '@work/domain/value-objects/said.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { describe, expect, it } from 'vitest';

describe('TaskNoteBody.heard', () => {
  it('keeps where it was said with what was said, and nothing generic over it', () => {
    const said = Said.of({
      body: 'can you please create a separate migration image?',
      path: 'apps/server/Dockerfile',
      from: 9,
    });

    expect(
      TaskNoteBody.heard('The pull request was commented on.', said).value,
    ).toBe(
      [
        'apps/server/Dockerfile:9',
        'can you please create a separate migration image?',
      ].join('\n'),
    );
  });

  it('says what happened where nobody said anything about it', () => {
    expect(TaskNoteBody.heard('The pull request was merged.', null).value).toBe(
      'The pull request was merged.',
    );
  });

  it("is a person's words alone where they pointed at no place", () => {
    const said = Said.of({ body: 'Ship it.' });

    expect(
      TaskNoteBody.heard('The pull request was commented on.', said).value,
    ).toBe('Ship it.');
  });
});

describe('TaskNoteBody.heldBack', () => {
  it('says a run held the task, where it moves once the run ends, and then what was heard', () => {
    expect(
      TaskNoteBody.heldBack(
        'The checks failed on the pull request.',
        null,
        StationName.of('Implementation'),
      ).value,
    ).toBe(
      [
        'Heard while a run held the task. It moves to Implementation when the run ends, unless the run passes it on.',
        '',
        'The checks failed on the pull request.',
      ].join('\n'),
    );
  });
});

describe('TaskNoteBody.interrupted', () => {
  it('says what happened while the station was working, and what a person can do about it', () => {
    expect(
      TaskNoteBody.interrupted(
        'The pull request was merged.',
        StationName.of('Implementation'),
      ).value,
    ).toBe(
      'The pull request was merged while Implementation was working. Close the task, or reply to carry on.',
    );
  });
});

describe('TaskNoteBody for a task standing on no station of its line', () => {
  it('says its station was working or waiting', () => {
    expect(
      TaskNoteBody.interrupted('The pull request was merged.', null).value,
    ).toBe(
      'The pull request was merged while its station was working. Close the task, or reply to carry on.',
    );
    expect(
      TaskNoteBody.interruptedWhileWaiting('The pull request was merged.', null)
        .value,
    ).toBe(
      'The pull request was merged while its station was waiting for an answer. Close the task, or reply to carry on.',
    );
  });
});

describe('TaskNoteBody.interruptedWhileWaiting', () => {
  it('says what happened while the station waited for an answer, and what a person can do about it', () => {
    expect(
      TaskNoteBody.interruptedWhileWaiting(
        'The pull request was merged.',
        StationName.of('Implementation'),
      ).value,
    ).toBe(
      'The pull request was merged while Implementation was waiting for an answer. Close the task, or reply to carry on.',
    );
  });
});
