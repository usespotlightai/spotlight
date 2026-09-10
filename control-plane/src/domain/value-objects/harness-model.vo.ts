import { InvalidHarnessModelError } from '@domain/exceptions/invalid-harness-model.error';

const MAX_LENGTH = 60;

/**
 * Which model a harness answers with. Stored on a station as an opaque id, the
 * way a harness is: what the id means is the harness's business, not the
 * domain's. A station carries one only where a harness works it.
 */
export class HarnessModel {
  private constructor(readonly value: string) {}

  static of(raw: string): HarnessModel {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidHarnessModelError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidHarnessModelError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new HarnessModel(trimmed);
  }

  equals(other: HarnessModel): boolean {
    return this.value === other.value;
  }
}
