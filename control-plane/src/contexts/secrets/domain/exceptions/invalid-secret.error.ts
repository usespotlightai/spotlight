import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export class InvalidSecretError extends Error {
  readonly kind = 'invalid' as const;

  readonly field: FieldPath;

  constructor(
    field: string | readonly (string | number)[],
    readonly because: string,
  ) {
    const path =
      typeof field === 'string' ? FieldPath.dotted(field) : FieldPath.of(field);

    super(`Secret ${path.segments.join('.')} ${because}.`);
    this.name = 'InvalidSecretError';
    this.field = path;
  }
}
