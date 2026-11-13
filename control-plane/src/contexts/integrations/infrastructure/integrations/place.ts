import type { ExpressionErrorDto } from '@integrations/application/dto/expression-check.dto';
import { CALLER_ABOUT } from '@integrations/domain/value-objects/action-caller.vo';
import type {
  Additions,
  ExpressionPosition,
} from '@integrations/infrastructure/integrations/expression-position';
import {
  positionAt,
  positionOf,
} from '@integrations/infrastructure/integrations/expression-positions';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import type { Scope } from '@platform/expressions/scope';
import {
  ANY_SEGMENT,
  FieldPath,
} from '@shared-kernel/domain/value-objects/field-path.vo';

interface PlaceWarning {
  readonly field: FieldPath;
  readonly message: string;
}

export interface CheckResult {
  readonly type: string | null;
  readonly errors: readonly ExpressionErrorDto[];
  readonly warnings: readonly PlaceWarning[];
}

const extentOf = (source: string) => ({
  start: source.length - source.trimStart().length,
  end: source.trimEnd().length,
});

export class Place {
  private constructor(
    readonly field: FieldPath,
    private readonly pattern: FieldPath,
    private readonly additions: Additions,
  ) {}

  static root(): Place {
    return new Place(FieldPath.root(), positionAt(FieldPath.root()), {});
  }

  to(fields: string): Place {
    const named = fields.split('.');

    return new Place(
      this.field.to(...named),
      this.pattern.to(...named),
      this.additions,
    );
  }

  each(key: string | number): Place {
    return new Place(
      this.field.to(key),
      this.pattern.to(ANY_SEGMENT),
      this.additions,
    );
  }

  inside(key: string | number): Place {
    return new Place(this.field.to(key), this.pattern, this.additions);
  }

  adding(additions: Additions): Place {
    return new Place(this.field, this.pattern, {
      ...this.additions,
      ...additions,
    });
  }

  checked(expressions: ExpressionEnginePort, source: string): CheckResult {
    const position = this.position;
    const warnings = position.shadowedIn(this.additions).map((captured) => ({
      field: captured.field,
      message: `shadows the built-in ${captured.name}`,
    }));
    const results = position.seen(this.additions).map((seen) => ({
      by: seen.by,
      ...this.typed(expressions, source, seen.scope),
    }));
    const shown = results.find((each) => each.errors.length > 0) ?? results[0];
    const by = shown.errors.length > 0 ? shown.by : null;
    const unbound =
      by === null
        ? null
        : this.typed(expressions, source, position.seenByAll(this.additions));

    if (unbound !== null && unbound.errors.length > 0) {
      return { ...unbound, warnings };
    }

    return {
      type: shown.type,
      errors:
        by !== null
          ? shown.errors.map((error) => ({
              ...error,
              message: `${error.message}. ${CALLER_ABOUT[by]} has no such variable`,
              suggestion: null,
            }))
          : shown.errors,
      warnings,
    };
  }

  private typed(
    expressions: ExpressionEnginePort,
    source: string,
    scope: Scope,
  ): Omit<CheckResult, 'warnings'> {
    const checked = expressions.check(source, scope);

    if (!checked.valid) {
      return {
        type: null,
        errors: [
          {
            message: checked.reason,
            span: checked.span,
            suggestion: checked.suggestion,
          },
        ],
      };
    }

    const problem = this.position.problem(checked.type);

    return {
      type: checked.type,
      errors: problem
        ? [{ message: problem, span: extentOf(source), suggestion: null }]
        : [],
    };
  }

  get position(): ExpressionPosition {
    return positionOf(this.pattern);
  }
}
