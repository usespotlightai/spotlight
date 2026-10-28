import { InvalidStationCheckError } from '@work/domain/exceptions/invalid-station-check.error';
import { WrittenText } from '@work/domain/value-objects/written-text';

const MAX_CHECK_LENGTH = 65_536;

export class StationCheck {
  private constructor(readonly value: string) {}

  static of(written: string): StationCheck {
    return new StationCheck(
      WrittenText.of(written, MAX_CHECK_LENGTH, InvalidStationCheckError),
    );
  }

  equals(other: StationCheck): boolean {
    return this.value === other.value;
  }
}
