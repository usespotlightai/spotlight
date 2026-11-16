import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { InvalidTurnHeadsError } from '@work/domain/exceptions/invalid-turn-heads.error';
import type { CheckoutHead } from '@work/domain/value-objects/checkout-head.vo';

const repeatsAPath = (heads: readonly CheckoutHead[]): boolean =>
  new Set(heads.map((each) => each.path)).size !== heads.length;

export class TurnHeads {
  private constructor(
    readonly runId: RunId,
    readonly started: readonly CheckoutHead[],
    readonly ended: readonly CheckoutHead[],
  ) {}

  static of(input: {
    runId: RunId;
    started: readonly CheckoutHead[];
    ended: readonly CheckoutHead[];
  }): TurnHeads {
    if (repeatsAPath(input.started) || repeatsAPath(input.ended)) {
      throw new InvalidTurnHeadsError(
        `of run ${input.runId.value} name one checkout twice`,
      );
    }

    return new TurnHeads(input.runId, input.started, input.ended);
  }

  equals(other: TurnHeads): boolean {
    return this.runId.equals(other.runId);
  }
}
