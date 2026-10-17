import type { ExpressionErrorDto } from '@integrations/application/dto/expression-check.dto';
import type {
  Additions,
  ExpressionPosition,
} from '@integrations/infrastructure/integrations/expression-position';
import {
  positionAt,
  positionOf,
} from '@integrations/infrastructure/integrations/expression-positions';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import {
  ANY_SEGMENT,
  FieldPath,
} from '@shared-kernel/domain/value-objects/field-path.vo';

interface PlaceWarning {
  readonly field: FieldPath;
  readonly message: string;
}

export interface Verdict {
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

  checked(expressions: ExpressionEnginePort, source: string): Verdict {
    const position = this.position;
    const warnings = position.shadowedIn(this.additions).map((captured) => ({
      field: captured.field,
      message: `shadows the built-in ${captured.name}`,
    }));
    const checked = expressions.check(source, position.seen(this.additions));

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
        warnings,
      };
    }

    const problem = position.problem(checked.type);

    return {
      type: checked.type,
      errors: problem
        ? [{ message: problem, span: extentOf(source), suggestion: null }]
        : [],
      warnings,
    };
  }

  get position(): ExpressionPosition {
    return positionOf(this.pattern);
  }
}
