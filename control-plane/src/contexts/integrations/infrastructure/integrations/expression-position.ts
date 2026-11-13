import type {
  ExpressionAddedVariable,
  ExpressionReturns,
  ExpressionCallDto,
} from '@integrations/application/dto/expression-check.dto';
import type { ActionCaller } from '@integrations/domain/value-objects/action-caller.vo';
import {
  ITEM,
  OUTSIDE,
  CALLER_VARIABLES,
  calledBy,
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
  readonly calls?: readonly ActionCaller[];
}

export interface Seen {
  readonly by: ActionCaller | null;
  readonly scope: Scope;
}

const LIST = /^list(<|$)/;

export class ExpressionPosition {
  constructor(
    readonly position: FieldPath,
    readonly scope: Scope,
    readonly returns: ExpressionReturns | null,
    readonly addedVariables: readonly ExpressionAddedVariable[],
    readonly callers: readonly ActionCaller[],
  ) {}

  callableBy(callers: readonly ActionCaller[]): ExpressionPosition {
    return new ExpressionPosition(
      this.position,
      calledBy(this.scope, callers),
      this.returns,
      this.addedVariables,
      callers,
    );
  }

  get calls(): readonly ExpressionCallDto[] {
    return this.callers.map((by) => ({
      by,
      variables: CALLER_VARIABLES[by].filter(
        (name) =>
          name in this.scope.declared ||
          this.addedVariables.some((added) => added === name),
      ),
    }));
  }

  seen(additions: Additions): readonly Seen[] {
    const calls = (additions.calls ?? []).filter((by) =>
      this.callers.includes(by),
    );

    return calls.length === 0
      ? [{ by: null, scope: this.seenByAll(additions) }]
      : calls.map((by) => ({
          by,
          scope: this.widened(calledBy(this.scope, [by]), additions, by),
        }));
  }

  seenByAll(additions: Additions): Scope {
    return this.widened(this.scope, additions, null);
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

  private widened(
    scope: Scope,
    additions: Additions,
    by: ActionCaller | null,
  ): Scope {
    const more: Record<string, Declared> = {};

    if (additions.body && 'body' in scope.declared) {
      more.body = { schema: additions.body };
    }

    if (additions.response && 'response' in scope.declared) {
      more.response = { schema: additions.response };
    }

    if (this.addsItem(additions)) {
      more[ITEM] = OUTSIDE;
    }

    for (const captured of this.capturesIn(additions)) {
      more[captured.name] = OUTSIDE;
    }

    if (
      additions.inputs &&
      this.addedVariables.includes('inputs') &&
      (by === null || CALLER_VARIABLES[by].includes('inputs'))
    ) {
      more.inputs = { schema: { ...additions.inputs } };
    }

    const types = additions.types ?? [];

    if (Object.keys(more).length === 0 && types.length === 0) {
      return scope;
    }

    const seen = scope.and(more);

    return types.length > 0 ? seen.typed(types) : seen;
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
