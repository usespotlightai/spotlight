import { ExpressionError } from '@platform/expressions/expression.errors';

const MAX_DEPTH = 24;
const MAX_NODES = 20_000;
const MAX_KEYS = 512;

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

export type Bindings = Readonly<Record<string, unknown>>;

// CEL rejects reserved names only in expressions. Remove them from the data also.
export const bound = (value: unknown): unknown => {
  let nodes = 0;

  const walk = (held: unknown, depth: number): unknown => {
    if (++nodes > MAX_NODES) {
      throw new ExpressionError('the delivery', 'holds more than can be read');
    }

    if (depth > MAX_DEPTH) {
      throw new ExpressionError(
        'the delivery',
        'is nested deeper than can be read',
      );
    }

    if (held === null || typeof held !== 'object') {
      return held;
    }

    if (Array.isArray(held)) {
      if (held.length > MAX_KEYS) {
        throw new ExpressionError(
          'the delivery',
          'holds a longer list than can be read',
        );
      }

      return held.map((each) => walk(each, depth + 1));
    }

    const plain: Record<string, unknown> = Object.create(null);

    for (const [key, each] of Object.entries(held).slice(0, MAX_KEYS)) {
      if (!RESERVED.has(key)) {
        plain[key] = walk(each, depth + 1);
      }
    }

    return plain;
  };

  return walk(value, 0);
};
