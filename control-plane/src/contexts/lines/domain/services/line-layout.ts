import type { StationKind } from '@lines/domain/entities/station.entity';
import type { LineRepositories } from '@lines/domain/value-objects/line-repositories.vo';
import type { PlanFlaw } from '@lines/domain/value-objects/plan-flaw';
import type {
  LineSearchPolicy,
  StationSearchOverride,
} from '@lines/domain/value-objects/search-policy.vo';
import { repeatedIn } from '@shared-kernel/domain/distinct';
import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';

interface Reference<R> {
  equals(other: R): boolean;
}

export interface LaidStation<R extends Reference<R>> {
  readonly at: R;
  readonly key: StationKey;
  readonly name: StationName;
  readonly kind: StationKind;
  readonly passesTo: readonly R[];
}

export interface LaidReaction<R extends Reference<R>> {
  readonly happening: Happening;
  readonly from: R | null;
  readonly to: R;
}

export interface LayoutProblem {
  readonly reason: string;
  readonly flaw: PlanFlaw;
}

const STATIONS: PlanFlaw = { in: 'line', rule: 'stations' };

const routing = (station: { readonly key: StationKey }): PlanFlaw => ({
  in: 'station',
  station: station.key,
  rule: 'routes',
});

const reactionAt = (
  reaction: number,
  rule: 'destination' | 'origin' | 'claim',
): PlanFlaw => ({ in: 'reaction', reaction, rule });

const among = <R extends Reference<R>>(
  references: readonly R[],
  reference: R,
): number => references.findIndex((each) => each.equals(reference));

export const stationsProblem = <R extends Reference<R>>(
  stations: readonly LaidStation<R>[],
): LayoutProblem | null => {
  if (stations.length === 0) {
    return { reason: 'must include at least one station', flaw: STATIONS };
  }

  const twice = repeatedIn(stations.map((each) => each.key.value));

  if (twice) {
    return {
      reason: `must have unique keys, but ${twice} repeats`,
      flaw: STATIONS,
    };
  }

  const backlogs = stations.filter((each) => each.kind === 'backlog');

  if (backlogs.length !== 1) {
    return {
      reason: `must include exactly one backlog, not ${backlogs.length}`,
      flaw: STATIONS,
    };
  }
  if (stations[0]?.kind !== 'backlog') {
    return { reason: 'must start with the backlog', flaw: STATIONS };
  }

  const ends = stations.filter((each) => each.kind === 'completed');

  if (ends.length !== 1) {
    return {
      reason: `must include exactly one completed station, not ${ends.length}`,
      flaw: STATIONS,
    };
  }
  if (stations[stations.length - 1]?.kind !== 'completed') {
    return { reason: 'must end with the completed station', flaw: STATIONS };
  }

  const agentStations = stations
    .filter((each) => each.kind === 'work')
    .map((each) => each.at);

  for (const station of stations) {
    if (station.kind === 'completed' && station.passesTo.length > 0) {
      return {
        reason: 'cannot pass on from the completed station',
        flaw: routing(station),
      };
    }

    for (const to of station.passesTo) {
      if (to.equals(station.at)) {
        return {
          reason: `cannot pass to themselves, but ${station.name.value} does`,
          flaw: routing(station),
        };
      }
      if (among(agentStations, to) < 0) {
        return {
          reason: `must pass to work stations, but ${station.name.value} does not`,
          flaw: routing(station),
        };
      }
    }
  }

  return null;
};

interface CheckingStation {
  readonly key: StationKey;
  readonly check: unknown;
  readonly diffs: boolean;
}

export const setupProblem = (
  stations: readonly CheckingStation[],
  repositories: LineRepositories,
): LayoutProblem | null => {
  const checking = stations.find((each) => each.check !== null && each.diffs);
  const unready = repositories.entries.find((each) => !each.setup);

  return checking && unready
    ? {
        reason: `needs a setup for repository ${unready.repository.value}. Station ${checking.key.value} checks its layers`,
        flaw: {
          in: 'repository',
          repository: unready.repository,
          rule: 'setup',
        },
      }
    : null;
};

interface SearchingStation {
  readonly key: StationKey;
  readonly search: StationSearchOverride | null;
}

export const searchProblem = (
  stations: readonly SearchingStation[],
  search: LineSearchPolicy,
): LayoutProblem | null => {
  for (const station of stations) {
    const problem = station.search && search.overrideProblem(station.search);

    if (problem) {
      return {
        reason: `station ${station.key.value} ${problem.reason}`,
        flaw: {
          in: 'station',
          station: station.key,
          rule: 'search',
          setting: problem.field,
        },
      };
    }
  }

  return null;
};

export const reactionsProblem = <R extends Reference<R>>(
  reactions: readonly LaidReaction<R>[],
  stations: readonly R[],
): LayoutProblem | null => {
  const claimed = new Set<string>();

  for (const [at, reaction] of reactions.entries()) {
    if (among(stations, reaction.to) < 0) {
      return {
        reason: `must send "${reaction.happening.value}" to a station on this line`,
        flaw: reactionAt(at, 'destination'),
      };
    }

    const from = reaction.from === null ? -1 : among(stations, reaction.from);

    if (reaction.from !== null && from < 0) {
      return {
        reason: `must wait for "${reaction.happening.value}" at a station on this line`,
        flaw: reactionAt(at, 'origin'),
      };
    }

    const claim = `${reaction.happening.value}@${from}`;

    if (claimed.has(claim)) {
      return {
        reason: `must send each happening to one station, but two wait for "${reaction.happening.value}"`,
        flaw: reactionAt(at, 'claim'),
      };
    }
    claimed.add(claim);
  }

  return null;
};
