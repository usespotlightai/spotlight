import { DONE, REVIEW } from '@domain/value-objects/declaration.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';

/** One thing a run may say when it hands the task over. */
export class HandoverOption {
  private constructor(readonly value: string) {}

  static station(name: StationName): HandoverOption {
    return new HandoverOption(name.value);
  }

  static review(): HandoverOption {
    return new HandoverOption(REVIEW);
  }

  static done(): HandoverOption {
    return new HandoverOption(DONE);
  }

  equals(other: HandoverOption): boolean {
    return this.value === other.value;
  }
}
