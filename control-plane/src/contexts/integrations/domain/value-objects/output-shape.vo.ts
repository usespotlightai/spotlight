import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  isJsonObject,
  type JsonObject,
  type JsonValue,
} from '@shared-kernel/domain/services/json-value';

interface ShapeField {
  readonly name: string;
  readonly shape: ShapeNode;
  readonly optional: boolean;
}

export type ShapeNode =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'null' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'number' }
  | { readonly kind: 'string' }
  | { readonly kind: 'unknown' }
  | { readonly kind: 'list'; readonly of: ShapeNode }
  | { readonly kind: 'record'; readonly of: ShapeNode }
  | { readonly kind: 'object'; readonly fields: readonly ShapeField[] }
  | { readonly kind: 'oneOf'; readonly shapes: readonly ShapeNode[] };

const DEEPEST = 5;

const MAX_FIELDS = 40;

const MAX_SAMPLED = 20;

const MAX_NODES = 400;

const MAX_CHOICES = 4;

const FIELD_NAME = /^[A-Za-z_$][A-Za-z0-9_$-]{0,63}$/;

const ID_LIKE = /\d{3,}|[0-9a-f]{8,}/i;

const NOTHING: ShapeNode = { kind: 'nothing' };

const UNKNOWN: ShapeNode = { kind: 'unknown' };

const SCALARS = ['null', 'boolean', 'number', 'string', 'unknown'] as const;

const namesAField = (key: string): boolean =>
  FIELD_NAME.test(key) && !ID_LIKE.test(key);

const churns = (known: number, given: number, unseen: number): boolean =>
  known > 0 && given > 0 && unseen * 2 > given;

const keyedByData = (keys: readonly string[]): boolean =>
  keys.length > MAX_FIELDS || !keys.every(namesAField);

class Budget {
  #left = MAX_NODES;

  take(): boolean {
    this.#left -= 1;

    return this.#left >= 0;
  }
}

const inferred = (value: unknown, depth: number, budget: Budget): ShapeNode => {
  if (!budget.take()) {
    return UNKNOWN;
  }

  if (value === null) {
    return { kind: 'null' };
  }

  if (typeof value === 'boolean') {
    return { kind: 'boolean' };
  }

  if (typeof value === 'number') {
    return { kind: 'number' };
  }

  if (typeof value === 'string') {
    return { kind: 'string' };
  }

  if (depth >= DEEPEST) {
    return UNKNOWN;
  }

  if (Array.isArray(value)) {
    return {
      kind: 'list',
      of: value
        .slice(0, MAX_SAMPLED)
        .map((each) => inferred(each, depth + 1, budget))
        .reduce(merged, NOTHING),
    };
  }

  if (!isJsonObject(value)) {
    return UNKNOWN;
  }

  const keys = Object.keys(value);

  if (keyedByData(keys)) {
    return {
      kind: 'record',
      of: Object.values(value)
        .slice(0, MAX_SAMPLED)
        .map((each) => inferred(each, depth + 1, budget))
        .reduce(merged, NOTHING),
    };
  }

  return {
    kind: 'object',
    fields: keys.sort().map((name) => ({
      name,
      shape: inferred((value as JsonObject)[name], depth + 1, budget),
      optional: false,
    })),
  };
};

const choicesOf = (node: ShapeNode): readonly ShapeNode[] =>
  node.kind === 'oneOf' ? node.shapes : [node];

const sameKind = (one: ShapeNode, other: ShapeNode): boolean =>
  one.kind === other.kind ||
  (one.kind === 'object' && other.kind === 'record') ||
  (one.kind === 'record' && other.kind === 'object');

const valuesOf = (node: ShapeNode): ShapeNode =>
  node.kind === 'object'
    ? node.fields.map((each) => each.shape).reduce(merged, NOTHING)
    : node.kind === 'record'
      ? node.of
      : UNKNOWN;

const objectsMerged = (
  one: Extract<ShapeNode, { kind: 'object' }>,
  other: Extract<ShapeNode, { kind: 'object' }>,
): ShapeNode => {
  const names = [
    ...new Set([...one.fields, ...other.fields].map((each) => each.name)),
  ].sort();
  const unseen = other.fields.filter(
    (each) => !one.fields.some((field) => field.name === each.name),
  ).length;

  if (
    keyedByData(names) ||
    churns(one.fields.length, other.fields.length, unseen)
  ) {
    return { kind: 'record', of: merged(valuesOf(one), valuesOf(other)) };
  }

  return {
    kind: 'object',
    fields: names.map((name) => {
      const mine = one.fields.find((each) => each.name === name);
      const theirs = other.fields.find((each) => each.name === name);

      return {
        name,
        shape: merged(mine?.shape ?? NOTHING, theirs?.shape ?? NOTHING),
        optional: !mine || !theirs || mine.optional || theirs.optional,
      };
    }),
  };
};

const alike = (one: ShapeNode, other: ShapeNode): ShapeNode => {
  if (one.kind === 'list' && other.kind === 'list') {
    return { kind: 'list', of: merged(one.of, other.of) };
  }

  if (one.kind === 'object' && other.kind === 'object') {
    return objectsMerged(one, other);
  }

  if (
    (one.kind === 'record' || one.kind === 'object') &&
    (other.kind === 'record' || other.kind === 'object')
  ) {
    return { kind: 'record', of: merged(valuesOf(one), valuesOf(other)) };
  }

  return one;
};

const merged = (one: ShapeNode, other: ShapeNode): ShapeNode => {
  if (one.kind === 'nothing') {
    return other;
  }

  if (other.kind === 'nothing') {
    return one;
  }

  if (one.kind === 'unknown' || other.kind === 'unknown') {
    return UNKNOWN;
  }

  const choices = [...choicesOf(one)];

  for (const each of choicesOf(other)) {
    const at = choices.findIndex((choice) => sameKind(choice, each));

    if (at < 0) {
      choices.push(each);
    } else {
      choices[at] = alike(choices[at] as ShapeNode, each);
    }
  }

  if (choices.length > MAX_CHOICES) {
    return UNKNOWN;
  }

  return choices.length === 1
    ? (choices[0] as ShapeNode)
    : { kind: 'oneOf', shapes: choices };
};

const bounded = (node: ShapeNode, depth: number, budget: Budget): ShapeNode => {
  if (!budget.take()) {
    return UNKNOWN;
  }

  switch (node.kind) {
    case 'list':
    case 'record':
      return depth >= DEEPEST
        ? UNKNOWN
        : { kind: node.kind, of: bounded(node.of, depth + 1, budget) };
    case 'object':
      return depth >= DEEPEST || keyedByData(node.fields.map((f) => f.name))
        ? UNKNOWN
        : {
            kind: 'object',
            fields: node.fields.map((each) => ({
              ...each,
              shape: bounded(each.shape, depth + 1, budget),
            })),
          };
    case 'oneOf':
      return node.shapes.length > MAX_CHOICES
        ? UNKNOWN
        : {
            kind: 'oneOf',
            shapes: node.shapes.map((each) => bounded(each, depth, budget)),
          };
    default:
      return node;
  }
};

const schemaOf = (node: ShapeNode): JsonObject => {
  switch (node.kind) {
    case 'nothing':
    case 'unknown':
      return {};
    case 'list':
      return { type: 'array', items: schemaOf(node.of) };
    case 'record':
      return { type: 'object', additionalProperties: schemaOf(node.of) };
    case 'object':
      return {
        type: 'object',
        properties: Object.fromEntries(
          node.fields.map((each) => [each.name, schemaOf(each.shape)]),
        ),
        required: node.fields
          .filter((each) => !each.optional)
          .map((each) => each.name),
        additionalProperties: false,
      };
    case 'oneOf':
      return { anyOf: node.shapes.map(schemaOf) };
    default:
      return { type: node.kind };
  }
};

const isScalar = (kind: string): kind is (typeof SCALARS)[number] =>
  (SCALARS as readonly string[]).includes(kind);

const read = (raw: unknown, depth: number): ShapeNode => {
  const refuse = () =>
    new InconsistentStateError(
      'learned output shape',
      'was kept in a form Spotlight does not read',
    );

  if (!isJsonObject(raw) || typeof raw.kind !== 'string' || depth > 64) {
    throw refuse();
  }

  if (raw.kind === 'nothing' || isScalar(raw.kind)) {
    return { kind: raw.kind } as ShapeNode;
  }

  if (raw.kind === 'list' || raw.kind === 'record') {
    return { kind: raw.kind, of: read(raw.of, depth + 1) };
  }

  if (raw.kind === 'oneOf' && Array.isArray(raw.shapes)) {
    return {
      kind: 'oneOf',
      shapes: raw.shapes.map((each) => read(each, depth + 1)),
    };
  }

  if (raw.kind === 'object' && Array.isArray(raw.fields)) {
    return {
      kind: 'object',
      fields: raw.fields.map((each) => {
        if (!isJsonObject(each) || typeof each.name !== 'string') {
          throw refuse();
        }

        return {
          name: each.name,
          shape: read(each.shape, depth + 1),
          optional: each.optional === true,
        };
      }),
    };
  }

  throw refuse();
};

export class OutputShape {
  private constructor(readonly node: ShapeNode) {}

  static of(answer: JsonValue): OutputShape {
    return new OutputShape(inferred(answer, 0, new Budget()));
  }

  static kept(raw: unknown): OutputShape {
    return new OutputShape(bounded(read(raw, 0), 0, new Budget()));
  }

  mergedWith(other: OutputShape): OutputShape {
    return new OutputShape(
      bounded(merged(this.node, other.node), 0, new Budget()),
    );
  }

  get schema(): JsonObject {
    return schemaOf(this.node);
  }

  toJson(): JsonValue {
    return this.node as unknown as JsonValue;
  }
}
