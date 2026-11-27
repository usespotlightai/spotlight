import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';

export class Opening {
  private constructor(
    readonly lineRole: string,
    readonly station: string | null,
  ) {}

  static of(input: { lineRole: string; station?: string | null }): Opening {
    const lineRole = LineRole.of(input.lineRole);
    const written = input.station?.trim();
    const station = !nonEmpty(written) ? null : StationKey.of(written);

    return new Opening(lineRole.value, station?.value ?? null);
  }

  equals(other: Opening): boolean {
    return this.lineRole === other.lineRole && this.station === other.station;
  }
}
