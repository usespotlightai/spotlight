import { repeatedIn } from '@shared-kernel/domain/services/distinct';
import type { StationKind } from '@work/domain/entities/station.entity';

interface LaidStation {
  readonly key: string;
  readonly name: string;
  readonly kind: StationKind;
  readonly passesTo: readonly string[];
}

interface LaidReaction {
  readonly happening: string;
  readonly from: string | null;
  readonly to: string;
}

export type LinePart =
  | {
      readonly of: 'line';
      readonly field: 'key' | 'stations' | 'repositories' | 'reviews' | null;
    }
  | {
      readonly of: 'station';
      readonly station: string;
      readonly field: 'passesTo' | 'tools' | 'skills' | 'harnessVersion';
    }
  | {
      readonly of: 'reaction';
      readonly place: number;
      readonly field: 'to' | 'from' | null;
    };

interface LayoutRefusal {
  readonly reason: string;
  readonly part: LinePart;
}

const STATIONS: LinePart = { of: 'line', field: 'stations' };

const handingOn = (station: LaidStation): LinePart => ({
  of: 'station',
  station: station.key,
  field: 'passesTo',
});

const reactionAt = (place: number, field: 'to' | 'from' | null): LinePart => ({
  of: 'reaction',
  place,
  field,
});

export const stationsRefused = (
  stations: readonly LaidStation[],
): LayoutRefusal | null => {
  if (stations.length === 0) {
    return { reason: 'must number at least one', part: STATIONS };
  }

  const twice = repeatedIn(stations.map((each) => each.key));

  if (twice) {
    return {
      reason: `must each be named once, but two are named ${twice}`,
      part: STATIONS,
    };
  }

  const backlogs = stations.filter((each) => each.kind === 'backlog');

  if (backlogs.length !== 1) {
    return {
      reason: `must hold one backlog, but hold ${backlogs.length}`,
      part: STATIONS,
    };
  }
  if (stations[0]?.kind !== 'backlog') {
    return {
      reason:
        'must open with their backlog, which is where a task waits to start',
      part: STATIONS,
    };
  }

  const ends = stations.filter((each) => each.kind === 'completed');

  if (ends.length !== 1) {
    return {
      reason: `must hold one completed, but hold ${ends.length}`,
      part: STATIONS,
    };
  }
  if (stations[stations.length - 1]?.kind !== 'completed') {
    return {
      reason: 'must close with completed, which is where a merged task lands',
      part: STATIONS,
    };
  }

  const worked = new Set(
    stations.filter((each) => each.kind === 'work').map((each) => each.key),
  );

  for (const station of stations) {
    if (station.kind === 'completed' && station.passesTo.length > 0) {
      return {
        reason: 'must end where they end, but completed hands on somewhere',
        part: handingOn(station),
      };
    }

    for (const to of station.passesTo) {
      if (to === station.key) {
        return {
          reason: `must not hand on to themselves, but ${station.name} does`,
          part: handingOn(station),
        };
      }
      if (!worked.has(to)) {
        return {
          reason: `must hand on to a station work is done at, but ${station.name} does not`,
          part: handingOn(station),
        };
      }
    }
  }

  return null;
};

export const reactionsRefused = (
  reactions: readonly LaidReaction[],
  stationKeys: ReadonlySet<string>,
): LayoutRefusal | null => {
  const claimed = new Set<string>();

  for (const [at, reaction] of reactions.entries()) {
    if (!stationKeys.has(reaction.to)) {
      return {
        reason: `must send "${reaction.happening}" to a station on the line`,
        part: reactionAt(at, 'to'),
      };
    }
    if (reaction.from !== null && !stationKeys.has(reaction.from)) {
      return {
        reason: `must wait for "${reaction.happening}" at a station on the line`,
        part: reactionAt(at, 'from'),
      };
    }

    const standing = `${reaction.happening}@${reaction.from ?? '*'}`;

    if (claimed.has(standing)) {
      return {
        reason: `must send a happening to one station, but two wait for "${reaction.happening}"`,
        part: reactionAt(at, null),
      };
    }
    claimed.add(standing);
  }

  return null;
};
