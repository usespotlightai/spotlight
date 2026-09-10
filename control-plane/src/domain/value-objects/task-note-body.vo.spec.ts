import { Said } from '@domain/value-objects/said.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
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
