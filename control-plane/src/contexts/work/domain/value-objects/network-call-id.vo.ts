import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export class NetworkCallId {
  private constructor(readonly value: string) {}

  static of(raw: string): NetworkCallId {
    const value = raw.trim();

    if (!ID.test(value)) {
      throw new InvalidNetworkCallError('id must not be empty');
    }

    return new NetworkCallId(value);
  }

  equals(other: NetworkCallId): boolean {
    return this.value === other.value;
  }
}
