import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { describe, expect, it } from 'vitest';

describe('TaskNoteBody.receivedHappening', () => {
  it('keeps the place and the body of the anchor, and nothing generic over it', () => {
    const anchor = Anchor.of({
      body: 'can you please create a separate migration image?',
      path: 'apps/server/Dockerfile',
      from: 9,
    });

    expect(
      TaskNoteBody.receivedHappening(
        'The pull request was commented on.',
        anchor,
      ).value,
    ).toBe(
      [
        'apps/server/Dockerfile:9',
        'can you please create a separate migration image?',
      ].join('\n'),
    );
  });

  it('says what happened where it has no anchor', () => {
    expect(
      TaskNoteBody.receivedHappening('The pull request was merged.', null)
        .value,
    ).toBe('The pull request was merged.');
  });

  it("is a person's words alone where they pointed at no place", () => {
    const anchor = Anchor.of({ body: 'Ship it.' });

    expect(
      TaskNoteBody.receivedHappening(
        'The pull request was commented on.',
        anchor,
      ).value,
    ).toBe('Ship it.');
  });
});

describe('TaskNoteBody.deferredMove', () => {
  it('says a run worked on the task, where it moves once the run ends, and then what arrived', () => {
    expect(
      TaskNoteBody.deferredMove(
        'The checks failed on the pull request.',
        null,
        StationName.of('Implementation'),
      ).value,
    ).toBe(
      [
        'This arrived while a run worked on the task. If the run does not pass the task on, the task moves to Implementation when the run ends.',
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

describe('TaskNoteBody for a task on no station of its line', () => {
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
