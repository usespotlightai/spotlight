import { InvalidStationSetupError } from '@work/domain/exceptions/invalid-station-setup.error';
import { WrittenText } from '@work/domain/value-objects/written-text';

const MOST_SETUP_LENGTH = 500;

export class StationSetup {
  private constructor(readonly value: string) {}

  static of(written: string): StationSetup {
    return new StationSetup(
      WrittenText.oneLine(written, MOST_SETUP_LENGTH, InvalidStationSetupError),
    );
  }

  equals(other: StationSetup): boolean {
    return this.value === other.value;
  }
}
