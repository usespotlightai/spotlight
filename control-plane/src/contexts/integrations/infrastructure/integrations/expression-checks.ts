import type {
  ExpressionDeclarationDto,
  ExpressionPositionDto,
} from '@integrations/application/dto/expression-check.dto';
import type {
  CheckedExpression,
  ExpressionChecksPort,
} from '@integrations/application/ports/expression-checks.port';
import { HookExpressionChecks } from '@integrations/infrastructure/hooks/hook-expression-checks';
import {
  definitionAt,
  EXPRESSION_POSITIONS,
  positionAt,
} from '@integrations/infrastructure/integrations/expression-positions';
import {
  type Compiled,
  compileIntegration,
} from '@integrations/infrastructure/integrations/integration.compile';
import type { Place } from '@integrations/infrastructure/integrations/place';
import type { ExpressionEnginePort } from '@platform/expressions/expression-engine.port';
import type { Declared, SchemaFields } from '@platform/expressions/scope';
import type { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const OBJECT = 'object';

const REMEMBERED = 32;

const LONGEST_REMEMBERED = 256 * 1024;

const fieldsOf = (fields: SchemaFields): ExpressionDeclarationDto[] =>
  Object.entries(fields)
    .sort(([one], [other]) => one.localeCompare(other))
    .map(([name, field]) =>
      typeof field === 'string'
        ? { name, type: field, fields: [] }
        : { name, type: OBJECT, fields: fieldsOf(field) },
    );

const declarationsOf = (
  declared: Readonly<Record<string, Declared>>,
): ExpressionDeclarationDto[] =>
  fieldsOf(
    Object.fromEntries(
      Object.entries(declared).map(([name, each]) => [
        name,
        typeof each === 'string' ? each : each.schema,
      ]),
    ),
  );

const POSITIONS: readonly ExpressionPositionDto[] = EXPRESSION_POSITIONS.map(
  (position) => ({
    position: position.position,
    returns: position.returns,
    variables: declarationsOf(position.scope.declared),
    addedVariables: position.addedVariables,
  }),
);

type Found =
  | { readonly outcome: 'found'; readonly place: Place }
  | Exclude<CheckedExpression, { outcome: 'checked' }>;

export class ExpressionChecks implements ExpressionChecksPort {
  private readonly remembered = new Map<string, Compiled>();

  private readonly hooks: HookExpressionChecks;

  constructor(private readonly expressions: ExpressionEnginePort) {
    this.hooks = new HookExpressionChecks(expressions);
  }

  check(
    position: FieldPath,
    expression: string,
    definition: unknown,
  ): CheckedExpression {
    if (this.hooks.concerns(position)) {
      return this.hooks.check(position, expression, definition);
    }

    const within = definitionAt(position);

    if (!within || within.isRoot) {
      return { outcome: 'no-such-resource' };
    }

    const found = this.placeOf(within, definition);

    if (found.outcome !== 'found') {
      return found;
    }

    const result = found.place.checked(this.expressions, expression);

    return {
      outcome: 'checked',
      check: {
        type: result.type,
        errors: result.errors,
        warnings: result.warnings.map((warning) => ({
          position: positionAt(warning.field),
          message: warning.message,
        })),
      },
    };
  }

  positions(): readonly ExpressionPositionDto[] {
    return [...POSITIONS, ...this.hooks.positions()];
  }

  private placeOf(target: FieldPath, definition: unknown): Found {
    const compiled = this.compiled(definition);

    if (!compiled.ok) {
      return {
        outcome: 'invalid',
        problems: compiled.problems.filter((problem) => !problem.isWarning),
      };
    }

    const place = compiled.places.get(target.rendered);

    return place
      ? { outcome: 'found', place }
      : { outcome: 'no-expression-there' };
  }

  private compiled(raw: unknown): Compiled {
    const key = JSON.stringify(raw) ?? '';
    const known = this.remembered.get(key);

    if (known) {
      this.remembered.delete(key);
      this.remembered.set(key, known);

      return known;
    }

    const compiled = compileIntegration(raw, this.expressions);

    if (key.length > LONGEST_REMEMBERED) {
      return compiled;
    }

    this.remembered.set(key, compiled);

    if (this.remembered.size > REMEMBERED) {
      const [oldest] = this.remembered.keys();
      this.remembered.delete(oldest as string);
    }

    return compiled;
  }
}
