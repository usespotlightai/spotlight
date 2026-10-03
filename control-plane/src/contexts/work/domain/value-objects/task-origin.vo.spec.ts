import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { describe, expect, it } from 'vitest';

describe('TaskOrigin', () => {
  it('names the integration a happening came from', () => {
    expect(
      TaskOrigin.heardFrom(Happening.of('linear.issue.created')).value,
    ).toBe('linear');
  });

  it('names git and github as one integration', () => {
    expect(TaskOrigin.of('git').value).toBe('github');
    expect(
      TaskOrigin.heardFrom(Happening.of('github.pull_request.opened')).value,
    ).toBe('github');
  });

  it('is a person, or an integration named in lower case', () => {
    expect(TaskOrigin.person().value).toBe('person');
    expect(() => TaskOrigin.of('Slack!')).toThrow(InconsistentStateError);
  });
});
