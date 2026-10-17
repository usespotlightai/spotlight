import type { Recipient } from '@secrets/domain/value-objects/recipient.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class SecretFetcher {
  private readonly kind = 'secret-fetcher';

  private constructor(
    readonly recipient: Recipient,
    readonly sharedEgress: string | null,
  ) {}

  static sidecar(recipient: Recipient): SecretFetcher {
    return new SecretFetcher(recipient, null);
  }

  static shared(recipient: Recipient, egressId: string): SecretFetcher {
    if (egressId.trim().length === 0) {
      throw new InconsistentStateError(
        'secret fetcher',
        'was named with no egress',
      );
    }

    return new SecretFetcher(recipient, egressId);
  }

  static of(recipient: Recipient, sharedEgress: string | null): SecretFetcher {
    return sharedEgress === null
      ? SecretFetcher.sidecar(recipient)
      : SecretFetcher.shared(recipient, sharedEgress);
  }

  matches(pinned: SecretFetcher): boolean {
    return pinned.sharedEgress === null
      ? this.sharedEgress === null && this.recipient.equals(pinned.recipient)
      : this.sharedEgress === pinned.sharedEgress;
  }

  equals(other: SecretFetcher): boolean {
    return (
      this.kind === other.kind &&
      this.sharedEgress === other.sharedEgress &&
      this.recipient.equals(other.recipient)
    );
  }
}
