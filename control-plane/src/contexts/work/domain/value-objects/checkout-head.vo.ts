import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { InvalidCheckoutHeadError } from '@work/domain/exceptions/invalid-checkout-head.error';

const FULL_COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export interface CheckoutHeadParts {
  readonly path: string;
  readonly commit: string;
}

export class CheckoutHead {
  private constructor(
    readonly path: string,
    readonly commit: string,
  ) {}

  static of(parts: CheckoutHeadParts): CheckoutHead {
    const path = parts.path.trim();
    const commit = parts.commit.trim();

    if (!path || !FULL_COMMIT.test(commit)) {
      throw new InvalidCheckoutHeadError(
        `needs a checkout path and a full commit SHA, not ${JSON.stringify(parts)}`,
      );
    }

    return new CheckoutHead(path, commit);
  }

  static rehydrate(parts: CheckoutHeadParts): CheckoutHead {
    try {
      return CheckoutHead.of(parts);
    } catch (error) {
      if (error instanceof InvalidCheckoutHeadError) {
        throw new InconsistentStateError('checkout head', error.message);
      }

      throw error;
    }
  }

  get parts(): CheckoutHeadParts {
    return { path: this.path, commit: this.commit };
  }

  equals(other: CheckoutHead): boolean {
    return this.path === other.path && this.commit === other.commit;
  }
}
