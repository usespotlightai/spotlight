import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

export class CheckExpressionQuery {
  constructor(
    readonly position: FieldPath,
    readonly expression: string,
    readonly definition: unknown,
    readonly principal: Principal,
  ) {}
}
