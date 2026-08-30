import { InvalidStretchIdError } from '@domain/exceptions/invalid-stretch-id.error';
import { StretchId } from '@domain/value-objects/stretch-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

describe('StretchId', () => {
  it('names the task and the note it opens with', () => {
    const id = StretchId.of({ taskId: TaskId.of('task_1'), from: 3 });

    expect(id.value).toBe('task_1:3');
  });

  it('comes back the same after a round trip', () => {
    const id = StretchId.of({ taskId: TaskId.of('task_1'), from: 3 });

    expect(StretchId.parse(id.value).equals(id)).toBe(true);
  });

  // Ids are opaque, and one holding a colon would take the task apart in the
  // wrong place if the task were read off the front.
  it('reads the note off the end, whatever the task id holds', () => {
    const id = StretchId.parse('urn:task:7:2');

    expect(id.taskId.value).toBe('urn:task:7');
    expect(id.from).toBe(2);
  });

  it('refuses what does not name a note', () => {
    expect(() => StretchId.parse('task_1')).toThrow(InvalidStretchIdError);
    expect(() => StretchId.parse('task_1:later')).toThrow(
      InvalidStretchIdError,
    );
    expect(() => StretchId.parse('task_1:-1')).toThrow(InvalidStretchIdError);
    expect(() => StretchId.parse(':0')).toThrow(InvalidStretchIdError);
  });
});
