import { InvalidTaskTitleError } from '@work/domain/exceptions/invalid-task-title.error';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

describe('TaskTitle', () => {
  it('takes a title, trimmed', () => {
    expect(TaskTitle.of('  Fix the queue  ').value).toBe('Fix the queue');
  });

  it('refuses an empty title', () => {
    expect(() => TaskTitle.of('   ')).toThrow(InvalidTaskTitleError);
  });

  it('refuses one longer than it allows', () => {
    expect(() => TaskTitle.of('x'.repeat(201))).toThrow(InvalidTaskTitleError);
  });

  it('clamps a title from outside to fit, rather than refusing it', () => {
    const clamped = TaskTitle.clamp('x'.repeat(500));

    expect(clamped.value).toHaveLength(200);
  });

  it('still refuses an empty title when clamping', () => {
    expect(() => TaskTitle.clamp('   ')).toThrow(InvalidTaskTitleError);
  });
});
