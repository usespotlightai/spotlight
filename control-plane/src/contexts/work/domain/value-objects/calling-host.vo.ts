import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';

const SHAPE = /^[A-Za-z0-9_-]{1,64}$/;

export class CallingHost {
  private constructor(readonly value: string) {}

  static of(raw: string): CallingHost {
    const value = raw.trim();

    if (!SHAPE.test(value)) {
      throw new InvalidNetworkCallError('must be claimed by a named host');
    }

    return new CallingHost(value);
  }

  equals(other: CallingHost): boolean {
    return this.value === other.value;
  }
}
