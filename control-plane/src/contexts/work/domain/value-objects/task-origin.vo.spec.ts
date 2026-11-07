import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { describe, expect, it } from 'vitest';

describe('TaskOrigin', () => {
  it('names the integration a happening came from', () => {
    const origin = TaskOrigin.receivedFrom(
      Happening.of('linear.issue.created'),
    );

    expect(origin.value).toBe('linear');
    expect(origin.integration?.value).toBe('linear');
  });

  it('reads back a stored integration as that integration', () => {
    expect(
      TaskOrigin.of('github').equals(
        TaskOrigin.receivedFrom(Happening.of('github.pull_request.opened')),
      ),
    ).toBe(true);
  });

  it('is a person, or an integration named in lower case', () => {
    expect(TaskOrigin.person().value).toBe('person');
    expect(TaskOrigin.of('person').equals(TaskOrigin.person())).toBe(true);
    expect(TaskOrigin.person().integration).toBeNull();
    expect(() => TaskOrigin.of('Slack!')).toThrow(InconsistentStateError);
  });

  it('tells a task passed on from a station apart from one a person opened', () => {
    expect(TaskOrigin.passed().equals(TaskOrigin.person())).toBe(false);
    expect(TaskOrigin.passed().value).toBe('station');
  });
});
