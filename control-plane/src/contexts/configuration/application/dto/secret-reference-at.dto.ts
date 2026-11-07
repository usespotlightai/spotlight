import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export interface SecretReferenceAt {
  readonly path: FieldPath;
  readonly name: string;
}
