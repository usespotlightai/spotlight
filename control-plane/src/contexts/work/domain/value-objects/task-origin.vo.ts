import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Happening } from '@work/domain/value-objects/happening.vo';

const PERSON = 'person';

const INTEGRATION = /^[a-z][a-z0-9_-]*$/;

const SAME_INTEGRATION: Readonly<Record<string, string>> = { git: 'github' };

export class TaskOrigin {
  private constructor(readonly value: string) {}

  static person(): TaskOrigin {
    return new TaskOrigin(PERSON);
  }

  static receivedFrom(happening: Happening): TaskOrigin {
    return TaskOrigin.of(happening.integration);
  }

  static of(raw: string): TaskOrigin {
    if (raw !== PERSON && !INTEGRATION.test(raw)) {
      throw new InconsistentStateError(
        'task',
        'was raised by a person or received from an integration it names',
      );
    }

    return new TaskOrigin(SAME_INTEGRATION[raw] ?? raw);
  }
}
