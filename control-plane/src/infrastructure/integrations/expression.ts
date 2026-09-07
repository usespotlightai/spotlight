import { parse } from '@marcbachmann/cel-js';

/**
 * Every one of these bounds the work an expression can ask for: CEL cannot
 * loop, but it can walk a list, and the list comes from outside.
 */
const MOST_DEPTH = 24;
const MOST_NODES = 20_000;
const MOST_KEYS = 512;
const LONGEST_EXPRESSION = 2_000;

/** Names that reach past a plain object in JavaScript, whatever CEL thinks. */
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

export class ExpressionError extends Error {
  readonly violation = 'invalid' as const;

  constructor(source: string, reason: string) {
    super(`${source}: ${reason}`);
    this.name = 'ExpressionError';
  }
}

/** What an expression is evaluated against: one delivery, and nothing else. */
export type Bindings = Readonly<Record<string, unknown>>;

export interface Expression {
  readonly source: string;
  /** Throws where the delivery has nothing at the path the expression names. */
  evaluate(against: Bindings): unknown;
}

/**
 * Parsed once, when configuration is read, so an expression nobody can parse
 * is a problem with the file rather than a delivery that fails at midnight.
 */
export const compile = (source: string): Expression => {
  const written = source.trim();

  if (written.length === 0) {
    throw new ExpressionError(source, 'is empty');
  }

  // A long expression is not dangerous so much as unreadable, and the bound
  // is what keeps parsing itself cheap.
  if (written.length > LONGEST_EXPRESSION) {
    throw new ExpressionError(
      written.slice(0, 40),
      `is longer than ${LONGEST_EXPRESSION} characters`,
    );
  }

  let evaluator: (context: Bindings) => unknown;

  try {
    evaluator = parse(written) as unknown as (context: Bindings) => unknown;
  } catch (error) {
    throw new ExpressionError(
      written,
      error instanceof Error
        ? (error.message.split('\n')[0] ?? 'will not parse')
        : 'will not parse',
    );
  }

  return {
    source: written,
    evaluate: (against: Bindings) => evaluator(against),
  };
};

/**
 * Anything not plainly true is false, including what could not be evaluated:
 * CEL throws on a missing key, so a rule written for one shape of delivery
 * meets another and simply does not match.
 */
export const holds = (expression: Expression, against: Bindings): boolean => {
  try {
    return expression.evaluate(against) === true;
  } catch {
    return false;
  }
};

/**
 * What an expression reads out of a delivery, as text. Null where it names
 * nothing there, which is how a source says it recognised no such thing.
 */
export const reads = (
  expression: Expression,
  against: Bindings,
): string | null => {
  try {
    const read = expression.evaluate(against);

    if (read === null || read === undefined || read === '') {
      return null;
    }

    // CEL counts in bigints, and a host that numbers something is naming it.
    return typeof read === 'object' ? null : String(read);
  } catch {
    return null;
  }
};

/**
 * What an expression evaluates to, whole: a map for a request body, a scalar
 * for a header. Null where it names nothing there or could not be evaluated.
 */
export const value = (expression: Expression, against: Bindings): unknown => {
  try {
    const read = expression.evaluate(against);

    return read === undefined ? null : read;
  } catch {
    return null;
  }
};

/**
 * Plain values on objects that inherit nothing. CEL refuses a reserved name
 * itself; this makes it true of the data, so it stays true of whatever reads
 * the delivery next.
 */
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
