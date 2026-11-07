import { InvalidToolInputError } from '@work/domain/exceptions/invalid-tool-input.error';

export const DIFF_SIDES = ['new', 'old'] as const;

export type DiffSideName = (typeof DIFF_SIDES)[number];

export class DiffSide {
  private constructor(readonly value: DiffSideName) {}

  static fromInput(raw: string | null): DiffSide {
    const named = raw?.trim() || 'new';
    const side = DIFF_SIDES.find((each) => each === named);

    if (!side) {
      throw new InvalidToolInputError(
        'review-comment',
        `side must be one of ${DIFF_SIDES.join(', ')}, not ${named}`,
      );
    }

    return new DiffSide(side);
  }

  equals(other: DiffSide): boolean {
    return this.value === other.value;
  }
}
