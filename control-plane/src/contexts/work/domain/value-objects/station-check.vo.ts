import { InvalidStationCheckError } from '@work/domain/exceptions/invalid-station-check.error';

const MOST_CHECK_LENGTH = 500;

export class StationCheck {
  private constructor(readonly value: string) {}

  static of(raw: string): StationCheck {
    const trimmed = raw.trim();

    if (
      !trimmed ||
      trimmed.length > MOST_CHECK_LENGTH ||
      /[\r\n]/.test(trimmed)
    ) {
      throw new InvalidStationCheckError(
        `is one line of at most ${MOST_CHECK_LENGTH} characters`,
      );
    }

    return new StationCheck(raw);
  }

  equals(other: StationCheck): boolean {
    return this.value === other.value;
  }
}
