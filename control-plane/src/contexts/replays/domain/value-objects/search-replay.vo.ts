import type { ReplayCharge } from '@replays/domain/services/replay-charge';
import type { Money } from '@replays/domain/value-objects/money.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayStopReason } from '@replays/domain/value-objects/replay-state';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export class SearchReplay {
  private constructor(
    readonly replayId: ReplayId,
    readonly started: boolean,
    readonly end: ReplayStopReason | null,
    readonly spent: Money | null,
    readonly unpriced: number,
  ) {}

  static planned(replayId: ReplayId): SearchReplay {
    return new SearchReplay(replayId, false, null, null, 0);
  }

  static rehydrate(input: {
    replayId: ReplayId;
    started: boolean;
    end: ReplayStopReason | null;
    spent: Money | null;
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
      input.started || input.end !== null,
      input.end,
      input.spent,
      input.unpriced,
    );
  }

  get awaitsStart(): boolean {
    return !this.started && this.end === null;
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

  asStarted(): SearchReplay {
    return this.started
      ? this
      : new SearchReplay(
          this.replayId,
          true,
          this.end,
          this.spent,
          this.unpriced,
        );
  }

  endedAs(end: ReplayStopReason, charge: ReplayCharge): SearchReplay {
    return this.end === null
      ? new SearchReplay(
          this.replayId,
          true,
          end,
          charge.spent,
          charge.unpriced,
        )
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
      : new SearchReplay(this.replayId, true, this.end, spent, unpriced);
  }

  equals(other: SearchReplay): boolean {
    return (
      this.replayId.equals(other.replayId) &&
      this.started === other.started &&
      this.end === other.end &&
      this.unpriced === other.unpriced &&
      ((this.spent === null && other.spent === null) ||
        (this.spent !== null &&
          other.spent !== null &&
          this.spent.equals(other.spent)))
    );
  }
}
