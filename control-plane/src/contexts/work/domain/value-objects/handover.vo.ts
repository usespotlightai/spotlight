import { DONE, REVIEW } from '@work/domain/value-objects/handover-word';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';

export class Handover {
  private constructor(
    readonly next: string,
    readonly note: string,
  ) {}

  static of(input: { next?: string; note?: string }): Handover {
    return new Handover((input.next ?? '').trim(), (input.note ?? '').trim());
  }

  sentToReview(reason: string): Handover {
    return new Handover(
      REVIEW,
      [reason.trim(), this.note === '' ? '' : `Note from the run: ${this.note}`]
        .filter(Boolean)
        .join('\n\n'),
    );
  }

  isDone(): boolean {
    return this.next.toLowerCase() === DONE;
  }

  requestsReview(): boolean {
    return this.next === '' || this.next.toLowerCase() === REVIEW;
  }

  names(key: StationKey): boolean {
    return key.value.toLowerCase() === this.next.toLowerCase();
  }

  equals(other: Handover): boolean {
    return this.next === other.next && this.note === other.note;
  }
}
