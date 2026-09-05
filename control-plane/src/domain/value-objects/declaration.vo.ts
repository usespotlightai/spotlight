import type { StationName } from '@domain/value-objects/station-name.vo';

export const REVIEW = 'review';

export const DONE = 'done';

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

  saysItIsDone(): boolean {
    return this.next.toLowerCase() === DONE;
  }

  asksForReview(): boolean {
    return this.next === '' || this.next.toLowerCase() === REVIEW;
  }

  names(station: StationName): boolean {
    return station.value.toLowerCase() === this.next.toLowerCase();
  }

  equals(other: Declaration): boolean {
    return this.next === other.next && this.note === other.note;
  }
}
