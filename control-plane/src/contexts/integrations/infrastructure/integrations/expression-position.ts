import type {
  ExpressionAddedVariable,
  ExpressionReturns,
} from '@integrations/application/dto/expression-check.dto';
import {
  ITEM,
  OUTSIDE,
} from '@integrations/infrastructure/integrations/scopes';
import type {
  Declared,
  NamedType,
  SchemaFields,
  Scope,
} from '@platform/expressions/scope';
import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

export interface Captured {
  readonly name: string;
  readonly field: FieldPath;
}

export interface Additions {
  readonly iterates?: boolean;
  readonly captured?: readonly Captured[];
  readonly inputs?: Readonly<Record<string, string>>;
  readonly body?: SchemaFields;
  readonly response?: SchemaFields;
  readonly types?: readonly NamedType[];
}

const LIST = /^list(<|$)/;

export class ExpressionPosition {
  constructor(
    readonly position: FieldPath,
    readonly scope: Scope,
    readonly returns: ExpressionReturns | null,
    readonly addedVariables: readonly ExpressionAddedVariable[],
  ) {}

  seen(additions: Additions): Scope {
    const more: Record<string, Declared> = {};

    if (additions.body && 'body' in this.scope.declared) {
      more.body = { schema: additions.body };
    }

    if (additions.response && 'response' in this.scope.declared) {
      more.response = { schema: additions.response };
    }

    if (this.addsItem(additions)) {
      more[ITEM] = OUTSIDE;
    }

    for (const captured of this.capturesIn(additions)) {
      more[captured.name] = OUTSIDE;
    }

    if (additions.inputs && this.addedVariables.includes('inputs')) {
      more.inputs = { schema: { ...additions.inputs } };
    }

    const types = additions.types ?? [];

    if (Object.keys(more).length === 0 && types.length === 0) {
      return this.scope;
    }

    const seen = this.scope.and(more);

    return types.length > 0 ? seen.typed(types) : seen;
  }

  shadowedIn(additions: Additions): readonly Captured[] {
    return this.capturesIn(additions).filter(
      (captured) =>
        captured.name in this.scope.declared ||
        (captured.name === ITEM && this.addsItem(additions)),
    );
  }

  problem(type: string): string | null {
    if (this.returns === null || type === OUTSIDE) {
      return null;
    }

    const fits = this.returns === 'bool' ? type === 'bool' : LIST.test(type);

    return fits ? null : `must return a ${this.returns}, not a ${type}`;
  }

  private addsItem(additions: Additions): boolean {
    return additions.iterates === true && this.addedVariables.includes('item');
  }

  private capturesIn(additions: Additions): readonly Captured[] {
    return this.addedVariables.includes('captures')
      ? (additions.captured ?? [])
      : [];
  }
}
