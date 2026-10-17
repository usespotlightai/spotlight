import type { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import type { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import type { Opening } from '@integrations/domain/value-objects/opening.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export class DeclaredHappening {
  private constructor(
    readonly happening: HappeningName,
    readonly label: string,
    readonly summary: string,
    readonly answers: boolean,
    readonly finds: readonly MarkKind[],
    readonly findsByBranch: boolean,
    readonly opens: Opening | null,
  ) {}

  static of(input: {
    happening: HappeningName;
    label: string;
    summary: string;
    answers?: boolean;
    finds?: readonly MarkKind[];
    findsByBranch?: boolean;
    opens?: Opening | null;
  }): DeclaredHappening {
    const label = input.label.trim();
    const summary = input.summary.trim();

    if (label.length === 0) {
      throw new InvalidIdentifierError(
        'happening label',
        'is what a person picking one of these will read',
      );
    }

    if (summary.length === 0) {
      throw new InvalidIdentifierError(
        'happening summary',
        'is how this reads in a note when it arrives',
      );
    }

    const finds = input.finds ?? [];
    const findsByBranch = input.findsByBranch ?? false;

    if (finds.length === 0 && !findsByBranch) {
      throw new InvalidIdentifierError(
        'happening',
        'needs a branch or a mark. Without one, no task can be found from it',
      );
    }

    return new DeclaredHappening(
      input.happening,
      label,
      summary,
      input.answers ?? false,
      finds,
      findsByBranch,
      input.opens ?? null,
    );
  }
}
