import { DONE, REVIEW } from '@work/domain/value-objects/handover-word';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';

export class Declaration {
  private constructor(
    readonly next: string,
    readonly note: string,
  ) {}

  static of(input: { next?: string; note?: string }): Declaration {
    return new Declaration(
      (input.next ?? '').trim(),
      (input.note ?? '').trim(),
    );
  }

  heldBack(reason: string): Declaration {
    return new Declaration(
      REVIEW,
      [reason.trim(), this.note === '' ? '' : `The run said: ${this.note}`]
        .filter(Boolean)
        .join('\n\n'),
    );
  }

  saysItIsDone(): boolean {
    return this.next.toLowerCase() === DONE;
  }

  asksForReview(): boolean {
    return this.next === '' || this.next.toLowerCase() === REVIEW;
  }

  names(key: StationKey): boolean {
    return key.value.toLowerCase() === this.next.toLowerCase();
  }

  equals(other: Declaration): boolean {
    return this.next === other.next && this.note === other.note;
  }
}
