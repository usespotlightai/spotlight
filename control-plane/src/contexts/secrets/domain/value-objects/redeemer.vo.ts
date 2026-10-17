import type { RedemptionRecipient } from '@secrets/domain/value-objects/redemption-recipient.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class Redeemer {
  private readonly kind = 'redeemer';

  private constructor(
    readonly recipient: RedemptionRecipient,
    readonly sharedEgress: string | null,
  ) {}

  static beside(recipient: RedemptionRecipient): Redeemer {
    return new Redeemer(recipient, null);
  }

  static shared(recipient: RedemptionRecipient, egressId: string): Redeemer {
    if (egressId.trim().length === 0) {
      throw new InconsistentStateError('redeemer', 'was named with no egress');
    }

    return new Redeemer(recipient, egressId);
  }

  static of(
    recipient: RedemptionRecipient,
    sharedEgress: string | null,
  ): Redeemer {
    return sharedEgress === null
      ? Redeemer.beside(recipient)
      : Redeemer.shared(recipient, sharedEgress);
  }

  mayFollow(pinned: Redeemer): boolean {
    return pinned.sharedEgress === null
      ? this.sharedEgress === null && this.recipient.equals(pinned.recipient)
      : this.sharedEgress === pinned.sharedEgress;
  }

  equals(other: Redeemer): boolean {
    return (
      this.kind === other.kind &&
      this.sharedEgress === other.sharedEgress &&
      this.recipient.equals(other.recipient)
    );
  }
}
