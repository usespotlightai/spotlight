import { UnplaceableHappeningError } from '@integrations/domain/exceptions/unplaceable-happening.error';
import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import type { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import type { Opening } from '@integrations/domain/value-objects/opening.vo';

export interface RaisedMark {
  readonly kind: MarkKind;
  readonly value: string;
  readonly finds: boolean;
}

export interface RaisedOpening {
  readonly title: string | null;
  readonly description: string | null;
  readonly assignEmail: string | null;
}

export interface OpenedTask {
  readonly opening: Opening;
  readonly title: string;
  readonly description: string | null;
  readonly assignEmail: string | null;
}

export class RaisedHappening {
  private constructor(
    readonly declared: DeclaredHappening,
    readonly branch: string | null,
    readonly marks: readonly RaisedMark[],
    readonly opens: OpenedTask | null,
  ) {}

  static of(
    declared: DeclaredHappening,
    raised: {
      readonly branch: string | null;
      readonly marks: readonly RaisedMark[];
      readonly opening: RaisedOpening | null;
    },
  ): RaisedHappening {
    const branch = raised.branch || null;
    const marks = raised.marks.filter((each) => each.value.length > 0);

    if (!branch && !marks.some((each) => each.finds)) {
      throw new UnplaceableHappeningError(declared.happening.value);
    }

    const title = raised.opening?.title || null;

    return new RaisedHappening(
      declared,
      branch,
      marks,
      declared.opens && raised.opening && title
        ? {
            opening: declared.opens,
            title,
            description: raised.opening.description,
            assignEmail: raised.opening.assignEmail,
          }
        : null,
    );
  }

  get finding(): readonly RaisedMark[] {
    return this.marks.filter((each) => each.finds);
  }

  equals(other: RaisedHappening): boolean {
    const sameMarks =
      this.marks.length === other.marks.length &&
      this.marks.every(
        (each, at) =>
          each.kind.equals(other.marks[at]?.kind ?? each.kind) &&
          each.value === other.marks[at]?.value &&
          each.finds === other.marks[at]?.finds,
      );

    return (
      this.declared.happening.value === other.declared.happening.value &&
      this.branch === other.branch &&
      sameMarks
    );
  }
}
