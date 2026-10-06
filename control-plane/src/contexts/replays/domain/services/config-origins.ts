import type { ChangeAskedAbout } from '@replays/domain/services/changes-asked-about';
import {
  inStretchOrder,
  latestStartsAt,
  type StretchBound,
  type StretchStart,
} from '@replays/domain/services/stretch-starts';
import {
  ConfigOrigin,
  type PossibleOrigin,
} from '@replays/domain/value-objects/config-origin.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';

interface CreditedTo {
  readonly candidateId: string;
  readonly name: string;
  readonly withdrawn: boolean;
}

export interface Adoption {
  readonly at: Date;
  readonly live: boolean;
  readonly creditedTo: CreditedTo | null;
}

const byId = (one: string, other: string): number =>
  one < other ? -1 : one > other ? 1 : 0;

const newestFirst = (one: PossibleOrigin, other: PossibleOrigin): number =>
  other.candidate.createdAt.getTime() - one.candidate.createdAt.getTime() ||
  byId(one.candidate.id.value, other.candidate.id.value);

const creditedFor = (
  start: StretchStart,
  possible: readonly PossibleOrigin[],
): ConfigOrigin | null => {
  const origin = possible
    .filter((each) => ConfigOrigin.mayHaveMade(each, start))
    .sort(newestFirst)[0];

  return origin ? ConfigOrigin.credited(start, origin) : null;
};

export const boundsOf = (
  possible: readonly PossibleOrigin[],
): readonly StretchBound[] =>
  possible.map(({ stationId, candidate }) => ({
    stationId,
    from: candidate.createdAt,
  }));

export const originAskedAbout = (
  change: ChangeAskedAbout,
  starts: readonly StretchStart[],
  possible: readonly PossibleOrigin[],
): ConfigOrigin | null => {
  const governing = starts.find(
    (each) =>
      each.stationId === change.stationId && each.runId.equals(change.runId),
  );

  return governing ? creditedFor(governing, possible) : null;
};

export const latestCredited = (
  starts: readonly StretchStart[],
  possible: readonly PossibleOrigin[],
): ReadonlyMap<string, ConfigOrigin> => {
  const latest = new Map<string, ConfigOrigin>();

  for (const start of [...starts].sort(inStretchOrder)) {
    const origin = creditedFor(start, possible);

    if (origin) {
      latest.set(origin.candidate.id.value, origin);
    }
  }

  return latest;
};

const creditedToOf = (
  origin: ConfigOrigin,
  latest: StretchStart | undefined,
  possible: readonly PossibleOrigin[],
): CreditedTo | null => {
  if (
    !latest ||
    latest.runId.equals(origin.start.runId) ||
    !latest.fingerprint.equals(origin.fingerprint)
  ) {
    return null;
  }

  const later = creditedFor(latest, possible);

  return later && !later.candidate.id.equals(origin.candidate.id)
    ? {
        candidateId: later.candidate.id.value,
        name: later.candidate.name.value,
        withdrawn: later.withdrawn,
      }
    : null;
};

export const adoptionsOf = (
  credited: ReadonlyMap<string, ConfigOrigin>,
  starts: readonly StretchStart[],
  possible: readonly PossibleOrigin[],
  liveAt: (stationId: string) => StationFingerprint | null,
): ReadonlyMap<string, Adoption> => {
  const latest = latestStartsAt(starts);

  return new Map(
    [...credited].map(([candidateId, origin]) => {
      const latestHere = latest.get(origin.stationId);

      return [
        candidateId,
        {
          at: origin.changedAt,
          live:
            latestHere?.runId.equals(origin.start.runId) === true &&
            liveAt(origin.stationId)?.equals(origin.fingerprint) === true,
          creditedTo: creditedToOf(origin, latestHere, possible),
        },
      ];
    }),
  );
};
