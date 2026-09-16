import { InvalidLabelNameError } from '@domain/exceptions/invalid-label-name.error';

const MAX_LENGTH = 50;

export class LabelName {
  private constructor(readonly value: string) {}

  static of(raw: string): LabelName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidLabelNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidLabelNameError(`must be at most ${MAX_LENGTH} characters`);
    }

    return new LabelName(trimmed);
  }

  equals(other: LabelName): boolean {
    return this.value === other.value;
  }
}
