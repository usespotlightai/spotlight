import type { HarnessIncompatibility } from '@configuration/domain/value-objects/harness-compatibility.vo';
import { DomainError } from '@shared-kernel/domain/exceptions/domain-error';

export class IncompatibleHarnessProfileError extends DomainError {
  readonly kind = 'invalid' as const;

  constructor(
    readonly key: string,
    readonly incompatibilities: readonly HarnessIncompatibility[],
  ) {
    super(`No harness can apply harness profile ${key} as it is written.`);
    this.name = 'IncompatibleHarnessProfileError';
  }
}
