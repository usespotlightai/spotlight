import {
  isJsonObject,
  isJsonValue,
  type JsonObject,
  type JsonValue,
  owns,
  sameJson,
} from '@shared-kernel/domain/services/json-value';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const INPUT_TYPES = [
  'string',
  'number',
  'integer',
  'boolean',
  'object',
  'array',
  'null',
] as const;

export type InputType = (typeof INPUT_TYPES)[number];

export type ScalarInputType = 'string' | 'number' | 'integer' | 'boolean';

const DEEPEST = 8;

const DECIMAL = /^-?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

const MAX_SHOWN = 80;

const TYPE_WORDS: Readonly<Record<InputType, string>> = {
  string: 'text',
  number: 'a number',
  integer: 'a whole number',
  boolean: 'true or false',
  object: 'an object',
  array: 'a list',
  null: 'null',
};

export interface InputProblem {
  readonly at: FieldPath;
  readonly why: string;
}

type Raw = Readonly<Record<string, unknown>>;

const isRaw = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isInputType = (value: unknown): value is InputType =>
  (INPUT_TYPES as readonly unknown[]).includes(value);

const listOf = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

const textOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

const numberOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const countOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : null;

const flattened = (raw: Raw, seen: ReadonlySet<object>): Raw => {
  const all = listOf(raw.allOf).filter(
    (each): each is Raw => isRaw(each) && !seen.has(each),
  );

  if (all.length === 0) {
    return raw;
  }

  const merged: Record<string, unknown> = Object.fromEntries(
    Object.entries(raw).filter(([field]) => field !== 'allOf'),
  );
  const properties: Record<string, unknown> = {};
  const required: unknown[] = [];

  for (const each of [
    raw,
    ...all.map((member) => flattened(member, new Set([...seen, member]))),
  ]) {
    for (const [field, value] of Object.entries(each)) {
      if (!(field in merged)) {
        merged[field] = value;
      }
    }

    Object.assign(
      properties,
      Object.fromEntries(
        Object.entries(isRaw(each.properties) ? each.properties : {}).filter(
          ([field]) => !(field in properties),
        ),
      ),
    );
    required.push(...listOf(each.required));
  }

  return { ...merged, properties, required };
};

const normalised = (
  given: unknown,
  depth: number,
  seen: ReadonlySet<object>,
): JsonObject => {
  if (!isRaw(given) || depth >= DEEPEST || seen.has(given)) {
    return {};
  }

  const within = new Set([...seen, given]);
  const raw = flattened(given, within);
  const deeper = (each: unknown) => normalised(each, depth + 1, within);
  const written: Record<string, JsonValue> = {};

  const types = [
    ...new Set(
      (Array.isArray(raw.type) ? raw.type : [raw.type]).filter(isInputType),
    ),
  ];
  if (types.length === 1) {
    written.type = types[0] as InputType;
  } else if (types.length > 1) {
    written.type = types;
  }

  const listed = listOf(raw.enum).filter(isJsonValue);
  if (listed.length > 0) {
    written.enum = listed;
  }

  if ('const' in raw && isJsonValue(raw.const)) {
    written.const = raw.const;
  }

  if (isRaw(raw.properties)) {
    written.properties = Object.fromEntries(
      Object.entries(raw.properties).map(([field, each]) => [
        field,
        deeper(each),
      ]),
    );
  }

  const required = [
    ...new Set(
      listOf(raw.required).filter(
        (each): each is string => typeof each === 'string',
      ),
    ),
  ];
  if (required.length > 0) {
    written.required = required;
  }

  if (typeof raw.additionalProperties === 'boolean') {
    written.additionalProperties = raw.additionalProperties;
  }

  if (isRaw(raw.items)) {
    written.items = deeper(raw.items);
  }

  for (const choice of ['anyOf', 'oneOf'] as const) {
    const choices = listOf(raw[choice]).filter(isRaw).map(deeper);
    if (choices.length > 0) {
      written[choice] = choices;
    }
  }

  const description = textOf(raw.description);
  if (description) {
    written.description = description;
  }

  if ('default' in raw && isJsonValue(raw.default)) {
    written.default = raw.default;
  }

  const examples = Array.isArray(raw.examples)
    ? raw.examples.filter(isJsonValue)
    : 'example' in raw && isJsonValue(raw.example)
      ? [raw.example]
      : [];
  if (examples.length > 0) {
    written.examples = examples;
  }

  for (const bound of ['minimum', 'maximum'] as const) {
    const read = numberOf(raw[bound]);
    if (read !== null) {
      written[bound] = read;
    }
  }

  for (const bound of ['minLength', 'maxLength'] as const) {
    const read = countOf(raw[bound]);
    if (read !== null) {
      written[bound] = read;
    }
  }

  for (const kept of ['pattern', 'format'] as const) {
    const read = textOf(raw[kept]);
    if (read) {
      written[kept] = read;
    }
  }

  return written;
};

const typesOf = (node: JsonObject): readonly InputType[] =>
  Array.isArray(node.type)
    ? (node.type as readonly InputType[])
    : typeof node.type === 'string'
      ? [node.type as InputType]
      : [];

const kindOf = (node: JsonObject): InputType | null => {
  const types = typesOf(node);

  if (types.length > 0) {
    return types.find((each) => each !== 'null') ?? 'null';
  }

  const listed = Array.isArray(node.enum)
    ? node.enum
    : 'const' in node
      ? [node.const as JsonValue]
      : [];
  const kinds = new Set(
    listed.map((each) =>
      typeof each === 'string'
        ? 'string'
        : typeof each === 'number'
          ? 'number'
          : typeof each === 'boolean'
            ? 'boolean'
            : null,
    ),
  );
  const [only] = [...kinds];

  return kinds.size === 1 && only ? only : null;
};

const isOfType = (type: InputType, value: JsonValue): boolean => {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return isJsonObject(value);
    case 'array':
      return Array.isArray(value);
    case 'null':
      return value === null;
  }
};

const shown = (value: JsonValue): string => {
  const written = JSON.stringify(value);

  return written.length > MAX_SHOWN
    ? `${written.slice(0, MAX_SHOWN - 1)}…`
    : written;
};

const lengthOf = (text: string): number => [...text].length;

const problemIn = (
  node: JsonObject,
  value: JsonValue,
  at: FieldPath,
): InputProblem | null => {
  const refuse = (why: string): InputProblem => ({ at, why });

  if ('const' in node && !sameJson(node.const as JsonValue, value)) {
    return refuse(`is not ${shown(node.const as JsonValue)}`);
  }

  if (
    Array.isArray(node.enum) &&
    !node.enum.some((each) => sameJson(each, value))
  ) {
    return refuse(`is not one of ${node.enum.map(shown).join(', ')}`);
  }

  const types = typesOf(node);

  if (types.length > 0 && !types.some((each) => isOfType(each, value))) {
    return refuse(
      `is not ${types.map((each) => TYPE_WORDS[each]).join(' or ')}`,
    );
  }

  if (typeof value === 'string') {
    const length = lengthOf(value);

    if (typeof node.minLength === 'number' && length < node.minLength) {
      return refuse(`is shorter than ${node.minLength} characters`);
    }

    if (typeof node.maxLength === 'number' && length > node.maxLength) {
      return refuse(`is longer than ${node.maxLength} characters`);
    }
  }

  if (typeof value === 'number') {
    if (typeof node.minimum === 'number' && value < node.minimum) {
      return refuse(`is less than ${node.minimum}`);
    }

    if (typeof node.maximum === 'number' && value > node.maximum) {
      return refuse(`is more than ${node.maximum}`);
    }
  }

  if (Array.isArray(value) && isJsonObject(node.items)) {
    const items = node.items;

    for (const [index, each] of value.entries()) {
      const found = problemIn(items, each, at.to(index));
      if (found) {
        return found;
      }
    }
  }

  if (isJsonObject(value)) {
    const properties = isJsonObject(node.properties) ? node.properties : {};
    const required = Array.isArray(node.required) ? node.required : [];
    const missing = required.find(
      (field) => typeof field === 'string' && !owns(value, field),
    );

    if (typeof missing === 'string') {
      return refuse(`needs ${missing}`);
    }

    for (const [field, each] of Object.entries(value)) {
      const shape = properties[field];

      if (isJsonObject(shape)) {
        const found = problemIn(shape, each, at.to(field));
        if (found) {
          return found;
        }
      } else if (node.additionalProperties === false) {
        return refuse(`takes no ${field}`);
      }
    }
  }

  for (const choice of ['anyOf', 'oneOf'] as const) {
    const choices = node[choice];

    if (
      Array.isArray(choices) &&
      !choices.some(
        (each) => isJsonObject(each) && problemIn(each, value, at) === null,
      )
    ) {
      return refuse('is none of the shapes it may take');
    }
  }

  return null;
};

const parsedJson = (text: string): JsonValue | undefined => {
  try {
    const parsed: unknown = JSON.parse(text);

    return isJsonValue(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export class InputSchema {
  private constructor(readonly written: JsonObject) {}

  static of(raw: unknown): InputSchema {
    return new InputSchema(normalised(raw, 0, new Set()));
  }

  static ofType(
    type: ScalarInputType,
    description: string | null = null,
  ): InputSchema {
    return InputSchema.of(description ? { type, description } : { type });
  }

  get type(): InputType | null {
    return kindOf(this.written);
  }

  get takesText(): boolean {
    return this.type === 'string';
  }

  get description(): string | null {
    return typeof this.written.description === 'string'
      ? this.written.description
      : null;
  }

  coerce(value: unknown): unknown {
    const type = this.type;

    if (this.problemWith(value) === null) {
      return value;
    }

    if (typeof value !== 'string') {
      return type === 'string' &&
        (typeof value === 'number' || typeof value === 'boolean')
        ? String(value)
        : value;
    }

    const trimmed = value.trim();

    switch (type) {
      case 'number':
      case 'integer':
        return DECIMAL.test(trimmed) ? Number(trimmed) : value;
      case 'boolean':
        return trimmed === 'true' ? true : trimmed === 'false' ? false : value;
      case 'object':
      case 'array':
        return parsedJson(trimmed) ?? value;
      case 'null':
        return trimmed === 'null' ? null : value;
      default: {
        const parsed =
          trimmed.startsWith('{') || trimmed.startsWith('[')
            ? parsedJson(trimmed)
            : undefined;

        return parsed !== undefined && this.problemWith(parsed) === null
          ? parsed
          : value;
      }
    }
  }

  problemWith(value: unknown): InputProblem | null {
    if (!isJsonValue(value)) {
      return { at: FieldPath.root(), why: 'is not JSON' };
    }

    return problemIn(this.written, value, FieldPath.root());
  }

  equals(other: InputSchema): boolean {
    return sameJson(this.written, other.written);
  }
}
