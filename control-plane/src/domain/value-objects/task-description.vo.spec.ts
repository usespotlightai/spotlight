import { InvalidTaskDescriptionError } from '@domain/exceptions/invalid-task-description.error';
import { TaskDescription } from '@domain/value-objects/task-description.vo';
import { describe, expect, it } from 'vitest';

describe('TaskDescription', () => {
  it('takes a description, trimmed', () => {
    expect(TaskDescription.of('  It loops forever.  ').value).toBe(
      'It loops forever.',
    );
  });

  it('refuses one longer than it allows', () => {
    expect(() => TaskDescription.of('x'.repeat(20_001))).toThrow(
      InvalidTaskDescriptionError,
    );
  });

  it('clamps a description from outside to fit, rather than refusing it', () => {
    expect(TaskDescription.clamp('x'.repeat(30_000)).value).toHaveLength(
      20_000,
    );
  });

  it('still refuses an empty description when clamping', () => {
    expect(() => TaskDescription.clamp('   ')).toThrow(
      InvalidTaskDescriptionError,
    );
  });
});
