import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';

const PERSON = 'person';

const INTEGRATION = 'integration:';

type Origin =
  | { readonly kind: 'person' }
  | { readonly kind: 'integration'; readonly integration: IntegrationName };

export class TaskOrigin {
  private constructor(private readonly origin: Origin) {}

  static person(): TaskOrigin {
    return new TaskOrigin({ kind: 'person' });
  }

  static receivedFrom(happening: Happening): TaskOrigin {
    return new TaskOrigin({
      kind: 'integration',
      integration: IntegrationName.ofHappening(happening),
    });
  }

  static decode(encoded: string): TaskOrigin {
    if (encoded === PERSON) {
      return TaskOrigin.person();
    }

    if (!encoded.startsWith(INTEGRATION)) {
      throw new InconsistentStateError(
        'task origin',
        `is neither a person nor an integration: "${encoded}"`,
      );
    }

    return new TaskOrigin({
      kind: 'integration',
      integration: IntegrationName.of(encoded.slice(INTEGRATION.length)),
    });
  }

  get encoded(): string {
    return this.origin.kind === 'integration'
      ? `${INTEGRATION}${this.origin.integration.value}`
      : PERSON;
  }

  get integration(): IntegrationName | null {
    return this.origin.kind === 'integration' ? this.origin.integration : null;
  }

  equals(other: TaskOrigin): boolean {
    return this.encoded === other.encoded;
  }
}
