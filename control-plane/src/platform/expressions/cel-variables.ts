import { ExpressionError } from '@platform/expressions/expression.errors';

const MAX_DEPTH = 24;
const MAX_NODES = 20_000;
const MAX_KEYS = 512;

const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

export type CelVariables = Readonly<Record<string, unknown>>;

// CEL rejects reserved names only in expressions. Remove them from the data also.
export const sanitizedForCel = (value: unknown): unknown => {
  let nodes = 0;

  const walk = (node: unknown, depth: number): unknown => {
    if (++nodes > MAX_NODES) {
      throw new ExpressionError('the payload', 'has more than can be read');
    }

    if (depth > MAX_DEPTH) {
      throw new ExpressionError(
        'the payload',
        'is nested deeper than can be read',
      );
    }

    if (node === null || typeof node !== 'object') {
      return node;
    }

    if (Array.isArray(node)) {
      if (node.length > MAX_KEYS) {
        throw new ExpressionError(
          'the payload',
          'has a longer list than can be read',
        );
      }

      return node.map((each) => walk(each, depth + 1));
    }

    const plain: Record<string, unknown> = Object.create(null);

    for (const [key, each] of Object.entries(node).slice(0, MAX_KEYS)) {
      if (!RESERVED.has(key)) {
        plain[key] = walk(each, depth + 1);
      }
    }

    return plain;
  };

  return walk(value, 0);
};
