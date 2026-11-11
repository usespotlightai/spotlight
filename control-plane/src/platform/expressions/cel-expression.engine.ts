import { Environment } from '@marcbachmann/cel-js';
import { Injectable } from '@nestjs/common';
import {
  type CelVariables,
  sanitizedForCel,
} from '@platform/expressions/cel-variables';
import type {
  CompileOptions,
  Expression,
  ExpressionCheck,
  ExpressionEnginePort,
  ExpressionSpan,
} from '@platform/expressions/expression-engine.port';
import {
  ExpressionError,
  firstLine,
} from '@platform/expressions/expression.errors';
import type { Scope } from '@platform/expressions/scope';
import { suggestionFor } from '@platform/expressions/suggestion';

const LONGEST_EXPRESSION = 2_000;

const HTML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>' };

const withFunctions = (environment: Environment): Environment =>
  environment
    .registerFunction(
      'parseJson(string): dyn',
      (text: string) => sanitizedForCel(JSON.parse(text)),
      { description: 'Reads a JSON text as a value.' },
    )
    .registerFunction(
      'htmlUnescape(string): string',
      (text: string) =>
        text.replace(
          /&(amp|lt|gt);/g,
          (_, name: string) => HTML_ENTITIES[name],
        ),
      { description: 'Decodes &amp;, &lt; and &gt; in a text.' },
    );

const PERMISSIVE = withFunctions(
  new Environment({
    unlistedVariablesAreDyn: true,
    homogeneousAggregateLiterals: false,
  }),
);

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
    if (source.length > LONGEST_EXPRESSION) {
      return {
        valid: false,
        reason: `is longer than ${LONGEST_EXPRESSION} characters`,
        span: null,
        suggestion: null,
      };
    }

    const checked = this.environmentOf(scope).check(source);

    if (checked.valid) {
      return { valid: true, type: checked.type ?? 'dyn' };
    }

    const reason = firstLine(checked.error, 'does not check');
    const span = spanOf(checked.error);

    return {
      valid: false,
      reason,
      span,
      suggestion: suggestionFor(source, reason, span, scope),
    };
  }

  compile(source: string, options: CompileOptions = {}): Expression {
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

    let evaluator: (context: CelVariables) => unknown;

    try {
      evaluator = PERMISSIVE.parse(written);
    } catch (error) {
      throw new ExpressionError(written, firstLine(error, 'will not parse'));
    }

    return {
      source: written,
      location: options.location ?? null,
      evaluate: (against: CelVariables) => evaluator(against),
    };
  }

  private environmentOf(scope: Scope): Environment {
    const cached = this.environments.get(scope);

    if (cached) {
      return cached;
    }

    const environment = withFunctions(
      new Environment({
        unlistedVariablesAreDyn: false,
        homogeneousAggregateLiterals: false,
      }),
    );

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
