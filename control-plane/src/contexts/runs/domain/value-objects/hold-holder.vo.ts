import { InvalidStartingPointHoldError } from '@runs/domain/exceptions/invalid-starting-point-hold.error';

const MAX_HOLDER_LENGTH = 200;

export class HoldHolder {
  private constructor(readonly value: string) {}

  static of(value: string): HoldHolder {
    const named = value.trim();

    if (named.length === 0 || named.length > MAX_HOLDER_LENGTH) {
      throw new InvalidStartingPointHoldError(
        `holder name must be 1 to ${MAX_HOLDER_LENGTH} characters`,
      );
    }

    return new HoldHolder(named);
  }
}
