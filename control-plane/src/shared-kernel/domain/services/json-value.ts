export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [field: string]: JsonValue };

export type JsonObject = { readonly [field: string]: JsonValue };

const DEEPEST = 64;

export const owns = (object: JsonObject, field: string): boolean =>
  Object.getOwnPropertyDescriptor(object, field) !== undefined;

export const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isJsonWithin = (value: unknown, depth: number): boolean => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return true;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value);
  }

  if (depth >= DEEPEST) {
    return false;
  }

  if (Array.isArray(value)) {
    return value.every((each) => isJsonWithin(each, depth + 1));
  }

  return (
    isJsonObject(value) &&
    Object.values(value).every((each) => isJsonWithin(each, depth + 1))
  );
};

export const isJsonValue = (value: unknown): value is JsonValue =>
  isJsonWithin(value, 0);

const sameWithin = (
  one: JsonValue,
  other: JsonValue,
  depth: number,
): boolean => {
  if (depth >= DEEPEST) {
    return false;
  }

  if (Array.isArray(one) || Array.isArray(other)) {
    return (
      Array.isArray(one) &&
      Array.isArray(other) &&
      one.length === other.length &&
      one.every((each, at) =>
        sameWithin(each, other[at] as JsonValue, depth + 1),
      )
    );
  }

  if (isJsonObject(one) || isJsonObject(other)) {
    if (!isJsonObject(one) || !isJsonObject(other)) {
      return false;
    }

    const fields = Object.keys(one);

    return (
      fields.length === Object.keys(other).length &&
      fields.every(
        (field) =>
          owns(other, field) &&
          sameWithin(
            one[field] as JsonValue,
            other[field] as JsonValue,
            depth + 1,
          ),
      )
    );
  }

  return one === other;
};

export const sameJson = (one: JsonValue, other: JsonValue): boolean =>
  sameWithin(one, other, 0);
