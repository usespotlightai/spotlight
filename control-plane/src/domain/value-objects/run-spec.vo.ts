import { InvalidRunSpecError } from '@domain/exceptions/invalid-run-spec.error';

export type RunSpecParts = object;

const samePart = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true;
  }

  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((each, index) => samePart(each, b[index]))
    );
  }

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  const rightKeys = new Set(Object.keys(right));

  return (
    keys.length === rightKeys.size &&
    keys.every((key) => rightKeys.has(key) && samePart(left[key], right[key]))
  );
};

export class RunSpec {
  private constructor(private readonly parts: RunSpecParts) {}

  static of(parts: RunSpecParts): RunSpec {
    if (Object.keys(parts).length === 0) {
      throw new InvalidRunSpecError('must be described');
    }

    // Defensive copy: the caller's object must not mutate this one.
    return new RunSpec({ ...parts });
  }

  static from(raw: unknown): RunSpec | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }

    try {
      return RunSpec.of(raw as RunSpecParts);
    } catch {
      return null;
    }
  }

  get value(): RunSpecParts {
    return { ...this.parts };
  }

  equals(other: RunSpec): boolean {
    return samePart(this.parts, other.parts);
  }
}
