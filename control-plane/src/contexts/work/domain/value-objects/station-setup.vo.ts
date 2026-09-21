import { InvalidStationSetupError } from '@work/domain/exceptions/invalid-station-setup.error';

const MOST_SETUP_LENGTH = 500;

export class StationSetup {
  private constructor(readonly value: string) {}

  static of(raw: string): StationSetup {
    const trimmed = raw.trim();

    if (
      !trimmed ||
      trimmed.length > MOST_SETUP_LENGTH ||
      /[\r\n]/.test(trimmed)
    ) {
      throw new InvalidStationSetupError(
        `is one line of at most ${MOST_SETUP_LENGTH} characters`,
      );
    }

    return new StationSetup(trimmed);
  }

  equals(other: StationSetup): boolean {
    return this.value === other.value;
  }
}
