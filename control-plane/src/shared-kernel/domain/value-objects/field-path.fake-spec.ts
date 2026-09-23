import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export const dottedOf = (field: FieldPath | undefined): string | undefined =>
  field?.segments.join('.');
