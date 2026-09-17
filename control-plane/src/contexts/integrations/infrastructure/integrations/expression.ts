import { Environment } from '@marcbachmann/cel-js';

const MOST_DEPTH = 24;
const MOST_NODES = 20_000;
const MOST_KEYS = 512;
const LONGEST_EXPRESSION = 2_000;

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

const PERMISSIVE = new Environment({
  unlistedVariablesAreDyn: true,
  homogeneousAggregateLiterals: false,
});

export class ExpressionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(source: string, reason: string) {
    super(`${source}: ${reason}`);
    this.name = 'ExpressionError';
  }
}

export class ExpressionFailedError extends Error {
  readonly violation = 'invalid' as const;

  constructor(
    readonly at: string | null,
    readonly source: string,
    readonly reason: string,
  ) {
    super(`${at ?? source}: ${reason}`);
    this.name = 'ExpressionFailedError';
  }
}

export type Bindings = Readonly<Record<string, unknown>>;

export type SchemaFields = { readonly [field: string]: string | SchemaFields };

export type Declared = string | { readonly schema: SchemaFields };

export type NamedType = readonly [name: string, fields: SchemaFields];

export class Scope {
  private held: Environment | null = null;

  private constructor(
    private readonly declared: Readonly<Record<string, Declared>>,
    private readonly types: readonly NamedType[] = [],
  ) {}

  static of(declared: Readonly<Record<string, Declared>>): Scope {
    return new Scope(declared);
  }

  and(more: Readonly<Record<string, Declared>>): Scope {
    return new Scope({ ...this.declared, ...more }, this.types);
  }

  typed(types: readonly NamedType[]): Scope {
    return new Scope(this.declared, types);
  }

  get names(): readonly string[] {
    return Object.keys(this.declared).sort();
  }

  get environment(): Environment {
    if (!this.held) {
      const environment = new Environment({
        unlistedVariablesAreDyn: false,
        homogeneousAggregateLiterals: false,
      });

      for (const [name, fields] of this.types) {
        environment.registerType({ name, schema: fields });
      }

      for (const [name, declared] of Object.entries(this.declared)) {
        if (typeof declared === 'string') {
          environment.registerVariable(name, declared);
        } else {
          environment.registerVariable({ name, schema: declared.schema });
        }
      }

      this.held = environment;
    }

    return this.held;
  }
}

export interface Expression {
  readonly source: string;
  readonly at: string | null;
  readonly doubt: string | null;
  evaluate(against: Bindings): unknown;
}

const firstLine = (error: unknown, otherwise: string): string =>
  error instanceof Error
    ? (error.message.split('\n')[0] ?? otherwise)
    : otherwise;

export const compile = (
  source: string,
  within: { readonly scope?: Scope; readonly at?: string } = {},
): Expression => {
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

  let doubt: string | null = null;

  if (within.scope) {
    const checked = within.scope.environment.check(written);

    if (!checked.valid) {
      doubt = firstLine(checked.error, 'does not check');
    }
  }

  return {
    source: written,
    at: within.at ?? null,
    doubt,
    evaluate: (against: Bindings) => evaluator(against),
  };
};

export const holds = (expression: Expression, against: Bindings): boolean => {
  try {
    return expression.evaluate(against) === true;
  } catch {
    return false;
  }
};

const asText = (read: unknown): string | null => {
  if (read === null || read === undefined || read === '') {
    return null;
  }

  return typeof read === 'object' ? null : String(read);
};

export const reads = (
  expression: Expression,
  against: Bindings,
): string | null => {
  try {
    return asText(expression.evaluate(against));
  } catch {
    return null;
  }
};

export const value = (expression: Expression, against: Bindings): unknown => {
  try {
    const read = expression.evaluate(against);

    return read === undefined ? null : read;
  } catch {
    return null;
  }
};

export const required = (
  expression: Expression,
  against: Bindings,
): unknown => {
  try {
    const read = expression.evaluate(against);

    return read === undefined ? null : read;
  } catch (error) {
    throw new ExpressionFailedError(
      expression.at,
      expression.source,
      firstLine(error, 'could not be read'),
    );
  }
};

export const requiredText = (
  expression: Expression,
  against: Bindings,
): string | null => asText(required(expression, against));

// CEL only rejects reserved names in expressions; strip them from data too.
export const bound = (value: unknown): unknown => {
  let nodes = 0;

  const walk = (held: unknown, depth: number): unknown => {
    if (++nodes > MOST_NODES) {
      throw new ExpressionError('the delivery', 'holds more than can be read');
    }

    if (depth > MOST_DEPTH) {
      throw new ExpressionError(
        'the delivery',
        'is nested deeper than can be read',
      );
    }

    if (held === null || typeof held !== 'object') {
      return held;
    }

    if (Array.isArray(held)) {
      if (held.length > MOST_KEYS) {
        throw new ExpressionError(
          'the delivery',
          'holds a longer list than can be read',
        );
      }

      return held.map((each) => walk(each, depth + 1));
    }

    const plain: Record<string, unknown> = Object.create(null);

    for (const [key, each] of Object.entries(held).slice(0, MOST_KEYS)) {
      if (!RESERVED.has(key)) {
        plain[key] = walk(each, depth + 1);
      }
    }

    return plain;
  };

  return walk(value, 0);
};
