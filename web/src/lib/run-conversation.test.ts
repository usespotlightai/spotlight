import { describe, expect, it } from 'vitest';
import { lastNoteOf } from '@/lib/run-conversation';

describe('lastNoteOf', () => {
  it('finds the last note of a run, so its thread opens there', () => {
    const notes = [
      { position: 0, runId: 'run_1' },
      { position: 1, runId: null },
      { position: 2, runId: 'run_2' },
      { position: 3, runId: 'run_2' },
    ];

    expect(lastNoteOf(notes, 'run_2')).toBe(3);
    expect(lastNoteOf(notes, 'run_9')).toBeNull();
  });
});
