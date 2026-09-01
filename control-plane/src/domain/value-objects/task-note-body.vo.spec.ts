import { Said } from '@domain/value-objects/said.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { describe, expect, it } from 'vitest';

describe('TaskNoteBody.heard', () => {
  it('keeps where it was said with what was said, under what happened', () => {
    const said = Said.of({
      body: 'can you please create a separate migration image?',
      path: 'apps/server/Dockerfile',
      from: 9,
    });

    expect(
      TaskNoteBody.heard('The pull request was commented on.', said).value,
    ).toBe(
      [
        'The pull request was commented on.',
        '',
        'apps/server/Dockerfile:9',
        'can you please create a separate migration image?',
      ].join('\n'),
    );
  });

  it('says only what happened where nothing was said about it', () => {
    expect(TaskNoteBody.heard('The pull request was merged.', null).value).toBe(
      'The pull request was merged.',
    );
  });

  it('leaves out a place nobody pointed at', () => {
    const said = Said.of({ body: 'Ship it.' });

    expect(
      TaskNoteBody.heard('The pull request was commented on.', said).value,
    ).toBe('The pull request was commented on.\n\nShip it.');
  });
});
