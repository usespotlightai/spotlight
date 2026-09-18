import { InvalidStationNameError } from '@work/domain/exceptions/invalid-station-name.error';

const MAX_LENGTH = 100;

export class StationName {
  private readonly kind = 'station-name' as const;

  private constructor(readonly value: string) {}

  static of(raw: string): StationName {
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      throw new InvalidStationNameError('must not be empty');
    }
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidStationNameError(
        `must be at most ${MAX_LENGTH} characters`,
      );
    }

    return new StationName(trimmed);
  }

  static unknown(): StationName {
    return StationName.of('Unknown');
  }

  static maybe(raw: string | null | undefined): StationName | null {
    try {
      return raw ? StationName.of(raw) : null;
    } catch {
      return null;
    }
  }

  equals(other: StationName): boolean {
    return this.value === other.value && this.kind === other.kind;
  }
}
