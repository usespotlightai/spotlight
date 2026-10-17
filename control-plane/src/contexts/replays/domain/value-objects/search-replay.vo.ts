import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayEnd } from '@replays/domain/value-objects/replay-state';
import type { Spend } from '@replays/domain/value-objects/spend.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class SearchReplay {
  private constructor(
    readonly replayId: ReplayId,
    readonly end: ReplayEnd | null,
    readonly spent: Spend | null,
    readonly unpriced: number,
  ) {}

  static started(replayId: ReplayId): SearchReplay {
    return new SearchReplay(replayId, null, null, 0);
  }

  static rehydrate(input: {
    replayId: ReplayId;
    end: ReplayEnd | null;
    spent: Spend | null;
    unpriced: number;
  }): SearchReplay {
    if ((input.end === null) !== (input.spent === null)) {
      throw new InconsistentStateError(
        'search replay',
        'knows what it spent when, and only when, it ended',
      );
    }
    if (!Number.isInteger(input.unpriced) || input.unpriced < 0) {
      throw new InconsistentStateError(
        'search replay',
        `counts ${input.unpriced} unpriced runs and calls, not a count`,
      );
    }

    return new SearchReplay(
      input.replayId,
      input.end,
      input.spent,
      input.unpriced,
    );
  }

  get hasEnded(): boolean {
    return this.end !== null;
  }

  get hasFinished(): boolean {
    return this.end === 'finished';
  }

  is(replayId: ReplayId): boolean {
    return this.replayId.equals(replayId);
  }

  endedAs(end: ReplayEnd, charge: ReplayCharge): SearchReplay {
    return this.end === null
      ? new SearchReplay(this.replayId, end, charge.spent, charge.unpriced)
      : this.spentAs(charge);
  }

  spentAs(charge: ReplayCharge): SearchReplay {
    const recorded = this.spent;

    if (
      this.end === null ||
      recorded === null ||
      !recorded.sameCurrencyAs(charge.spent)
    ) {
      return this;
    }

    const spent = charge.spent.isWithin(recorded) ? recorded : charge.spent;
    const unpriced = Math.max(this.unpriced, charge.unpriced);

    return spent === recorded && unpriced === this.unpriced
      ? this
      : new SearchReplay(this.replayId, this.end, spent, unpriced);
  }

  equals(other: SearchReplay): boolean {
    return (
      this.replayId.equals(other.replayId) &&
      this.end === other.end &&
      this.unpriced === other.unpriced &&
      ((this.spent === null && other.spent === null) ||
        (this.spent !== null &&
          other.spent !== null &&
          this.spent.equals(other.spent)))
    );
  }
}
