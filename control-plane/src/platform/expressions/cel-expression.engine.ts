import { Environment } from '@marcbachmann/cel-js';
import { Injectable } from '@nestjs/common';
import type { Bindings } from '@platform/expressions/bindings';
import {
  ExpressionError,
  firstLine,
} from '@platform/expressions/expression.errors';
import type {
  Expression,
  ExpressionCheck,
  ExpressionEnginePort,
  ExpressionSpan,
  Within,
} from '@platform/expressions/expression-engine.port';
import type { Scope } from '@platform/expressions/scope';

const LONGEST_EXPRESSION = 2_000;

const PERMISSIVE = new Environment({
  unlistedVariablesAreDyn: true,
  homogeneousAggregateLiterals: false,
});

const spanOf = (error: unknown): ExpressionSpan | null => {
  const range = (error as { range?: { start?: unknown; end?: unknown } })
    ?.range;

  return typeof range?.start === 'number' && typeof range.end === 'number'
    ? { start: range.start, end: range.end }
    : null;
};

@Injectable()
export class CelExpressionEngine implements ExpressionEnginePort {
  private readonly environments = new WeakMap<Scope, Environment>();

  check(source: string, scope: Scope): ExpressionCheck {
    const checked = this.environmentOf(scope).check(source);

    return checked.valid
      ? { valid: true, type: checked.type ?? 'dyn' }
      : {
          valid: false,
          reason: firstLine(checked.error, 'does not check'),
          span: spanOf(checked.error),
        };
  }

  compile(source: string, within: Within = {}): Expression {
    const written = source.trim();

    if (written.length === 0) {
      throw new ExpressionError(source, 'is empty');
    }

    if (written.length > LONGEST_EXPRESSION) {
      throw new ExpressionError(
        written.slice(0, 40),
        `is longer than ${LONGEST_EXPRESSION} characters`,
      );
    }

    let evaluator: (context: Bindings) => unknown;

    try {
      evaluator = PERMISSIVE.parse(written) as unknown as (
        context: Bindings,
      ) => unknown;
    } catch (error) {
      throw new ExpressionError(written, firstLine(error, 'will not parse'));
    }

    const checked = within.scope ? this.check(written, within.scope) : null;

    return {
      source: written,
      at: within.at ?? null,
      doubt: checked && !checked.valid ? checked.reason : null,
      evaluate: (against: Bindings) => evaluator(against),
    };
  }

  private environmentOf(scope: Scope): Environment {
    const held = this.environments.get(scope);

    if (held) {
      return held;
    }

    const environment = new Environment({
      unlistedVariablesAreDyn: false,
      homogeneousAggregateLiterals: false,
    });

    for (const [name, fields] of scope.types) {
      environment.registerType({ name, schema: fields });
    }

    for (const [name, declared] of Object.entries(scope.declared)) {
      if (typeof declared === 'string') {
        environment.registerVariable(name, declared);
      } else {
        environment.registerVariable({ name, schema: declared.schema });
      }
    }

    this.environments.set(scope, environment);

    return environment;
  }
}
