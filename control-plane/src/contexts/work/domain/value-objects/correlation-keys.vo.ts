import { Branch } from '@work/domain/value-objects/branch.vo';
import type { Mark } from '@work/domain/value-objects/mark.vo';

export class CorrelationKeys {
  private constructor(
    readonly branch: Branch | null,
    readonly marks: readonly Mark[],
  ) {}

  static of(input: {
    branch?: string | null;
    marks?: readonly (Mark | null)[];
  }): CorrelationKeys | null {
    const named = input.branch?.trim() ? Branch.of(input.branch) : null;
    const marked = (input.marks ?? []).filter((each): each is Mark => !!each);

    return named || marked.length > 0
      ? new CorrelationKeys(named, marked)
      : null;
  }

  equals(other: CorrelationKeys): boolean {
    return (
      (this.branch === null
        ? other.branch === null
        : other.branch !== null && this.branch.equals(other.branch)) &&
      this.marks.length === other.marks.length &&
      this.marks.every((each, index) => each.equals(other.marks[index]))
    );
  }
}
