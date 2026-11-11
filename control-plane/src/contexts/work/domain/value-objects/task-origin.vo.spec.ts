import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { TaskOrigin } from '@work/domain/value-objects/task-origin.vo';
import { describe, expect, it } from 'vitest';

describe('TaskOrigin', () => {
  it('names the integration a happening came from', () => {
    const origin = TaskOrigin.receivedFrom(
      Happening.of('linear.issue.created'),
    );

    expect(origin.encoded).toBe('integration:linear');
    expect(origin.integration?.value).toBe('linear');
  });

  it('reads back a stored integration as that integration', () => {
    expect(
      TaskOrigin.decode('integration:github').equals(
        TaskOrigin.receivedFrom(Happening.of('github.pull_request.opened')),
      ),
    ).toBe(true);
  });

  it('tells a person apart from an integration keyed person', () => {
    const integration = TaskOrigin.receivedFrom(
      Happening.of('person.card.created'),
    );

    expect(TaskOrigin.decode(TaskOrigin.person().encoded)).toEqual(
      TaskOrigin.person(),
    );
    expect(TaskOrigin.decode(integration.encoded).equals(integration)).toBe(
      true,
    );
    expect(integration.equals(TaskOrigin.person())).toBe(false);
  });

  it('refuses a stored origin that is neither a person nor an integration', () => {
    expect(() => TaskOrigin.decode('github')).toThrow(InconsistentStateError);
    expect(() => TaskOrigin.decode('integration:Slack!')).toThrow(
      InconsistentStateError,
    );
  });
});
