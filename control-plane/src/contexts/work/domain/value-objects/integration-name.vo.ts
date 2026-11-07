import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { isIntegrationKey } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class IntegrationName {
  private constructor(readonly value: string) {}

  static of(raw: string): IntegrationName {
    if (!isIntegrationKey(raw)) {
      throw new InconsistentStateError(
        'integration name',
        `must be lowercase letters and digits, not "${raw}"`,
      );
    }

    return new IntegrationName(raw);
  }

  static ofHappening(happening: Happening): IntegrationName {
    return IntegrationName.of(happening.integration);
  }

  equals(other: IntegrationName): boolean {
    return this.value === other.value;
  }
}
