import { InvalidRunSpecError } from '@domain/exceptions/invalid-run-spec.error';

export type RunSpecParts = object;

/** Carried whole and unread: what is in them is the runner's business. */
export class RunSpec {
  private constructor(private readonly parts: RunSpecParts) {}

  static of(parts: RunSpecParts): RunSpec {
    if (Object.keys(parts).length === 0) {
      throw new InvalidRunSpecError('must be described');
    }

    return new RunSpec(parts);
  }

  static from(raw: unknown): RunSpec | null {
    return raw && typeof raw === 'object' && !Array.isArray(raw)
      ? new RunSpec(raw as RunSpecParts)
      : null;
  }

  /** The whole of it, for whoever has to write it down or send it on. */
  get value(): RunSpecParts {
    return this.parts;
  }
}
