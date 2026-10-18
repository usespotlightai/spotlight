import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { describe, expect, it } from 'vitest';

const ISSUE = Mark.of('linear.issue', 'ENG-42');

describe('CorrelationKeys', () => {
  it('reads the task out of a branch named after it', () => {
    expect(CorrelationKeys.of({ branch: 'spotlight/task_1' })?.taskId).toEqual(
      TaskId.of('task_1'),
    );
  });

  it('reads no task out of a branch named anything else', () => {
    expect(
      CorrelationKeys.of({ branch: 'main', marks: [ISSUE] })?.taskId,
    ).toBeNull();
  });

  it('carries every handle the source recognised', () => {
    expect(CorrelationKeys.of({ marks: [ISSUE] })?.marks).toEqual([ISSUE]);
  });

  it('keeps only the handles there were', () => {
    expect(CorrelationKeys.of({ marks: [null, ISSUE, null] })?.marks).toEqual([
      ISSUE,
    ]);
  });

  it('is nothing where it names neither a task nor a handle', () => {
    expect(CorrelationKeys.of({})).toBeNull();
    expect(CorrelationKeys.of({ branch: 'main' })).toBeNull();
    expect(CorrelationKeys.of({ branch: 'main', marks: [null] })).toBeNull();
  });
});
