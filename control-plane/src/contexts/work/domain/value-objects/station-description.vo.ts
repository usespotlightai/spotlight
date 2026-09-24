import { InvalidStationDescriptionError } from '@work/domain/exceptions/invalid-station-description.error';
import { WrittenText } from '@work/domain/value-objects/written-text';

const MAX_LENGTH = 500;

export class StationDescription {
  private constructor(readonly value: string) {}

  static of(written: string): StationDescription {
    return new StationDescription(
      WrittenText.prose(written, MAX_LENGTH, InvalidStationDescriptionError),
    );
  }

  equals(other: StationDescription): boolean {
    return this.value === other.value;
  }
}
