import { Concerns } from '@domain/value-objects/concerns.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const ISSUE = Mark.of('linear.issue', 'ENG-42');

describe('Concerns', () => {
  it('reads the task out of a branch named after it', () => {
    expect(Concerns.of({ branch: 'spotlight/task_1' })?.taskId).toEqual(
      TaskId.of('task_1'),
    );
  });

  // A branch somebody named themselves says nothing about whose work it is.
  it('reads no task out of a branch named anything else', () => {
    expect(Concerns.of({ branch: 'main', marks: [ISSUE] })?.taskId).toBeNull();
  });

  it('carries every handle the source recognised', () => {
    expect(Concerns.of({ marks: [ISSUE] })?.marks).toEqual([ISSUE]);
  });

  // A source reading a delivery in pieces finds some of them and not others.
  it('keeps only the handles there were', () => {
    expect(Concerns.of({ marks: [null, ISSUE, null] })?.marks).toEqual([ISSUE]);
  });

  // Nothing to go on is not a task nobody has: it is a delivery that names
  // no task at all, and the source is told so rather than left guessing.
  it('is nothing where it names neither a task nor a handle', () => {
    expect(Concerns.of({})).toBeNull();
    expect(Concerns.of({ branch: 'main' })).toBeNull();
    expect(Concerns.of({ branch: 'main', marks: [null] })).toBeNull();
  });
});
