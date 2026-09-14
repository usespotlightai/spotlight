import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';
import type { MarkKind } from '@domain/value-objects/mark-kind.vo';
import type { StationKey } from '@domain/value-objects/station-key.vo';

export class DeclaredHappening {
  private constructor(
    readonly happening: Happening,
    readonly label: string,
    readonly told: string,
    readonly spoken: boolean,
    readonly finds: readonly MarkKind[],
    readonly findsByBranch: boolean,
    readonly opensOnto: LineRole | null,
    readonly opensAt: StationKey | null,
  ) {}

  static of(input: {
    happening: Happening;
    label: string;
    told: string;
    spoken?: boolean;
    finds?: readonly MarkKind[];
    findsByBranch?: boolean;
    opensOnto?: LineRole | null;
    opensAt?: StationKey | null;
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
      input.opensOnto ?? null,
      input.opensAt ?? null,
    );
  }
}
