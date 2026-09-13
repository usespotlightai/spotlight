import { InvalidStationColorError } from '@domain/exceptions/invalid-station-color.error';

const HEX = /^#[0-9a-f]{6}$/;

export class StationColor {
  private constructor(readonly value: string) {}

  static of(raw: string): StationColor {
    const normalised = raw.trim().toLowerCase();

    if (!HEX.test(normalised)) {
      throw new InvalidStationColorError(
        `must be a six digit hex like #6d78d5, but was "${raw}"`,
      );
    }

    return new StationColor(normalised);
  }

  // Lenient: stored rows may predate the current rules.
  static maybe(raw: string | null | undefined): StationColor | null {
    try {
      return raw ? StationColor.of(raw) : null;
    } catch {
      return null;
    }
  }

  equals(other: StationColor): boolean {
    return this.value === other.value;
  }
}
