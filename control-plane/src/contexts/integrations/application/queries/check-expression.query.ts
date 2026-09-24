import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export class CheckExpressionQuery {
  constructor(
    readonly position: FieldPath,
    readonly expression: string,
    readonly definition: unknown,
  ) {}
}
