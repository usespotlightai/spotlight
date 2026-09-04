import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { MarkKind } from '@domain/value-objects/mark-kind.vo';

/** One word a source can raise: the vocabulary, not the reading of it. */
export class DeclaredHappening {
  private constructor(
    readonly happening: Happening,
    /** What it is called where somebody picks one. */
    readonly label: string,
    /** How it reads in a note when it comes. */
    readonly told: string,
    /** A merge tells itself. Only a person speaking answers what was asked. */
    readonly spoken: boolean,
    readonly finds: readonly MarkKind[],
    readonly findsByBranch: boolean,
  ) {}

  static of(input: {
    happening: Happening;
    label: string;
    told: string;
    spoken?: boolean;
    finds?: readonly MarkKind[];
    findsByBranch?: boolean;
  }): DeclaredHappening {
    const label = input.label.trim();
    const told = input.told.trim();

    if (label.length === 0) {
      throw new InvalidIdentifierError(
        'happening label',
        'is what a person picking one of these will read',
      );
    }

    if (told.length === 0) {
      throw new InvalidIdentifierError(
        'happening told',
        'is how this reads in a note when it arrives',
      );
    }

    const finds = input.finds ?? [];
    const findsByBranch = input.findsByBranch ?? false;

    // A word about nothing could never reach a task, so nothing would ever
    // come of raising it. Better said here than wondered about later.
    if (finds.length === 0 && !findsByBranch) {
      throw new InvalidIdentifierError(
        'happening',
        'needs a branch or a mark, or nothing could find a task from it',
      );
    }

    return new DeclaredHappening(
      input.happening,
      label,
      told,
      input.spoken ?? false,
      finds,
      findsByBranch,
    );
  }
}
