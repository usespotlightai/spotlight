import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export class InvalidHookError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly at: FieldPath,
    readonly because: string,
  ) {
    super(`A hook's ${at.rendered} ${because}`);
    this.name = 'InvalidHookError';
  }
}
