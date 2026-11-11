import { InvalidHarnessModelError } from '@shared-kernel/domain/exceptions/invalid-harness-model.error';

export const HARNESS_MODEL_MAX_LENGTH = 60;

export class HarnessModel {
  private constructor(readonly value: string) {}

  static of(raw: string): HarnessModel {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidHarnessModelError('must not be empty');
    }
    if (trimmed.length > HARNESS_MODEL_MAX_LENGTH) {
      throw new InvalidHarnessModelError(
        `must be at most ${HARNESS_MODEL_MAX_LENGTH} characters`,
      );
    }

    return new HarnessModel(trimmed);
  }

  equals(other: HarnessModel): boolean {
    return this.value === other.value;
  }
}
