import type { StationKind } from '@work/domain/entities/station.entity';

export const entryOf = <
  S extends { readonly kind: StationKind; readonly position: number },
>(
  stations: readonly S[],
): S | null =>
  [...stations]
    .sort((a, b) => a.position - b.position)
    .find((each) => each.kind === 'work') ?? null;
