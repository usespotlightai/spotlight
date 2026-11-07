import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { IntegrationName } from '@work/domain/value-objects/integration-name.vo';

const PERSON = 'person';

const PASSED = 'station';

type Origin =
  | { readonly kind: 'person' }
  | { readonly kind: 'integration'; readonly integration: IntegrationName }
  | { readonly kind: 'passed' };

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

  static passed(): TaskOrigin {
    return new TaskOrigin({ kind: 'passed' });
  }

  static of(raw: string): TaskOrigin {
    return raw === PERSON
      ? TaskOrigin.person()
      : new TaskOrigin({
          kind: 'integration',
          integration: IntegrationName.of(raw),
        });
  }

  get value(): string {
    if (this.origin.kind === 'integration') {
      return this.origin.integration.value;
    }

    return this.origin.kind === 'person' ? PERSON : PASSED;
  }

  get integration(): IntegrationName | null {
    return this.origin.kind === 'integration' ? this.origin.integration : null;
  }

  equals(other: TaskOrigin): boolean {
    return this.origin.kind === other.origin.kind && this.value === other.value;
  }
}
