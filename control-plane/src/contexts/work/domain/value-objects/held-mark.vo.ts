import type { Mark } from '@work/domain/value-objects/mark.vo';

export class HeldMark {
  private constructor(
    readonly mark: Mark,
    readonly since: Date,
  ) {}

  static of(mark: Mark, since: Date): HeldMark {
    return new HeldMark(mark, since);
  }

  is(mark: Mark): boolean {
    return this.mark.equals(mark);
  }
}
