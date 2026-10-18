import { repeatedIn } from '@shared-kernel/domain/services/distinct';
import type { StationKind } from '@work/domain/entities/station.entity';
import type { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';

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
      readonly field: 'passesTo' | 'tools' | 'skills' | 'judge' | 'alerts';
    }
  | {
      readonly of: 'repository';
      readonly place: number;
      readonly field: 'setup';
    }
  | {
      readonly of: 'reaction';
      readonly place: number;
      readonly field: 'to' | 'from' | null;
    };

interface LayoutProblem {
  readonly reason: string;
  readonly part: LinePart;
}

const STATIONS: LinePart = { of: 'line', field: 'stations' };

const passingOn = (station: LaidStation): LinePart => ({
  of: 'station',
  station: station.key,
  field: 'passesTo',
});

const reactionAt = (place: number, field: 'to' | 'from' | null): LinePart => ({
  of: 'reaction',
  place,
  field,
});

export const stationsProblem = (
  stations: readonly LaidStation[],
): LayoutProblem | null => {
  if (stations.length === 0) {
    return { reason: 'must include at least one station', part: STATIONS };
  }

  const twice = repeatedIn(stations.map((each) => each.key));

  if (twice) {
    return {
      reason: `must have unique keys, but ${twice} repeats`,
      part: STATIONS,
    };
  }

  const backlogs = stations.filter((each) => each.kind === 'backlog');

  if (backlogs.length !== 1) {
    return {
      reason: `must include exactly one backlog, not ${backlogs.length}`,
      part: STATIONS,
    };
  }
  if (stations[0]?.kind !== 'backlog') {
    return {
      reason: 'must start with the backlog',
      part: STATIONS,
    };
  }

  const ends = stations.filter((each) => each.kind === 'completed');

  if (ends.length !== 1) {
    return {
      reason: `must include exactly one completed station, not ${ends.length}`,
      part: STATIONS,
    };
  }
  if (stations[stations.length - 1]?.kind !== 'completed') {
    return {
      reason: 'must end with the completed station',
      part: STATIONS,
    };
  }

  const agentStations = new Set(
    stations.filter((each) => each.kind === 'work').map((each) => each.key),
  );

  for (const station of stations) {
    if (station.kind === 'completed' && station.passesTo.length > 0) {
      return {
        reason: 'cannot pass on from the completed station',
        part: passingOn(station),
      };
    }

    for (const to of station.passesTo) {
      if (to === station.key) {
        return {
          reason: `cannot pass to themselves, but ${station.name} does`,
          part: passingOn(station),
        };
      }
      if (!agentStations.has(to)) {
        return {
          reason: `must pass to work stations, but ${station.name} does not`,
          part: passingOn(station),
        };
      }
    }
  }

  return null;
};

interface CheckingStation {
  readonly key: { readonly value: string };
  readonly check: unknown;
  readonly diffs: boolean;
}

export const setupProblem = (
  stations: readonly CheckingStation[],
  repositories: LineRepositories,
): LayoutProblem | null => {
  const checking = stations.find((each) => each.check !== null && each.diffs);
  const unready = repositories.entries.findIndex((each) => !each.setup);

  return checking && unready >= 0
    ? {
        reason: `needs a setup for repository ${repositories.entries[unready]?.repository.value}. Station ${checking.key.value} checks its layers`,
        part: { of: 'repository', place: unready, field: 'setup' },
      }
    : null;
};

export const reactionsProblem = (
  reactions: readonly LaidReaction[],
  stationKeys: ReadonlySet<string>,
): LayoutProblem | null => {
  const claimed = new Set<string>();

  for (const [at, reaction] of reactions.entries()) {
    if (!stationKeys.has(reaction.to)) {
      return {
        reason: `must send "${reaction.happening}" to a station on this line`,
        part: reactionAt(at, 'to'),
      };
    }
    if (reaction.from !== null && !stationKeys.has(reaction.from)) {
      return {
        reason: `must wait for "${reaction.happening}" at a station on this line`,
        part: reactionAt(at, 'from'),
      };
    }

    const claim = `${reaction.happening}@${reaction.from ?? '*'}`;

    if (claimed.has(claim)) {
      return {
        reason: `must send each happening to one station, but two wait for "${reaction.happening}"`,
        part: reactionAt(at, null),
      };
    }
    claimed.add(claim);
  }

  return null;
};
