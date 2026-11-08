import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import type { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';

export interface WarmCheckout {
  readonly path: string;
  readonly setup: string | null;
}

export class WarmPart {
  private constructor(
    readonly lineId: LineId,
    readonly placement: RunnerPlacement,
    readonly checkouts: readonly WarmCheckout[],
    readonly shape: string,
  ) {}

  static of(input: {
    lineId: LineId;
    placement: RunnerPlacement;
    checkouts: readonly WarmCheckout[];
    shape: string;
  }): WarmPart {
    const paths = input.checkouts.map((each) => each.path.trim());

    if (paths.length === 0 || paths.some((each) => each.length === 0)) {
      throw new InconsistentStateError(
        'warm sandbox',
        'needs at least one repository to check out, each with a path',
      );
    }

    if (new Set(paths).size !== paths.length) {
      throw new InconsistentStateError(
        'warm sandbox',
        'checks out two repositories at the same path',
      );
    }

    if (input.shape.trim().length === 0) {
      throw new InconsistentStateError('warm sandbox', 'needs a shape');
    }

    return new WarmPart(
      input.lineId,
      input.placement,
      input.checkouts.map((each) => ({
        path: each.path.trim(),
        setup: each.setup?.trim() || null,
      })),
      input.shape,
    );
  }

  get image(): RunnerImage | null {
    return this.placement.image;
  }

  fits(offer: RunnerOffer): boolean {
    return this.placement.matches(offer);
  }

  isFor(lineId: LineId): boolean {
    return this.lineId.equals(lineId);
  }
}
