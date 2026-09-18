import { InvalidStationDescriptionError } from '@work/domain/exceptions/invalid-station-description.error';

const MAX_LENGTH = 500;

export class StationDescription {
  private constructor(readonly value: string) {}

  static of(raw: string): StationDescription {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidStationDescriptionError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidStationDescriptionError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new StationDescription(trimmed);
  }

  equals(other: StationDescription): boolean {
    return this.value === other.value;
  }
}
