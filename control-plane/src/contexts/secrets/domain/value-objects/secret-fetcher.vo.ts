import type { EgressId } from '@secrets/domain/value-objects/egress-id.vo';
import type { Recipient } from '@secrets/domain/value-objects/recipient.vo';

export class SecretFetcher {
  private readonly kind = 'secret-fetcher';

  private constructor(
    readonly recipient: Recipient,
    readonly sharedEgress: EgressId | null,
  ) {}

  static sidecar(recipient: Recipient): SecretFetcher {
    return new SecretFetcher(recipient, null);
  }

  static shared(recipient: Recipient, egress: EgressId): SecretFetcher {
    return new SecretFetcher(recipient, egress);
  }

  static of(
    recipient: Recipient,
    sharedEgress: EgressId | null,
  ): SecretFetcher {
    return sharedEgress === null
      ? SecretFetcher.sidecar(recipient)
      : SecretFetcher.shared(recipient, sharedEgress);
  }

  matches(pinned: SecretFetcher): boolean {
    return pinned.sharedEgress === null
      ? this.sharedEgress === null && this.recipient.equals(pinned.recipient)
      : this.sharedEgress?.equals(pinned.sharedEgress) === true;
  }

  equals(other: SecretFetcher): boolean {
    return (
      this.kind === other.kind &&
      this.recipient.equals(other.recipient) &&
      (this.sharedEgress === null || other.sharedEgress === null
        ? this.sharedEgress === other.sharedEgress
        : this.sharedEgress.equals(other.sharedEgress))
    );
  }
}
