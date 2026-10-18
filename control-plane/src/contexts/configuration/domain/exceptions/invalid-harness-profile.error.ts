import type { FieldSegment } from '@shared-kernel/domain/value-objects/field-path.vo';

export class InvalidHarnessProfileError extends Error {
  readonly kind = 'invalid' as const;

  constructor(
    readonly field: readonly FieldSegment[],
    readonly because: string,
  ) {
    super(`Harness profile ${because}.`);
    this.name = 'InvalidHarnessProfileError';
  }
}
