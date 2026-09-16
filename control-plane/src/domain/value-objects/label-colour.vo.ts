import { InvalidLabelColourError } from '@domain/exceptions/invalid-label-colour.error';

const HEX = /^#[0-9a-f]{6}$/;

export class LabelColour {
  private constructor(readonly value: string) {}

  static of(raw: string): LabelColour {
    const normalised = raw.trim().toLowerCase();

    if (!HEX.test(normalised)) {
      throw new InvalidLabelColourError(
        `must be a six digit hex like #6d78d5, but was "${raw}"`,
      );
    }

    return new LabelColour(normalised);
  }

  equals(other: LabelColour): boolean {
    return this.value === other.value;
  }
}
