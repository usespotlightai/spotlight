import type { StationKind } from '@domain/entities/station.entity';
import { repeatedIn } from '@domain/services/distinct';

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

interface LayoutRefusal {
  readonly reason: string;
  readonly at: string;
}

const keyed = (value: string) => ({
  value,
  equals: (other: { value: string }) => other.value === value,
});

export const stationsRefused = (
  stations: readonly LaidStation[],
): LayoutRefusal | null => {
  if (stations.length === 0) {
    return { reason: 'must number at least one', at: 'stations' };
  }

  const twice = repeatedIn(stations.map((each) => keyed(each.key)));

  if (twice) {
    return {
      reason: `must each be named once, but two are named ${twice.value}`,
      at: 'stations',
    };
  }

  const backlogs = stations.filter((each) => each.kind === 'backlog');

  if (backlogs.length !== 1) {
    return {
      reason: `must hold one backlog, but hold ${backlogs.length}`,
      at: 'stations',
    };
  }
  if (stations[0]?.kind !== 'backlog') {
    return {
      reason:
        'must open with their backlog, which is where a task waits to start',
      at: 'stations',
    };
  }

  const ends = stations.filter((each) => each.kind === 'completed');

  if (ends.length !== 1) {
    return {
      reason: `must hold one completed, but hold ${ends.length}`,
      at: 'stations',
    };
  }
  if (stations[stations.length - 1]?.kind !== 'completed') {
    return {
      reason: 'must close with completed, which is where a merged task lands',
      at: 'stations',
    };
  }

  const worked = new Set(
    stations.filter((each) => each.kind === 'work').map((each) => each.key),
  );

  for (const [at, station] of stations.entries()) {
    if (station.kind === 'completed' && station.passesTo.length > 0) {
      return {
        reason: 'must end where they end, but completed hands on somewhere',
        at: `stations.${at}.passesTo`,
      };
    }

    for (const to of station.passesTo) {
      if (to === station.key) {
        return {
          reason: `must not hand on to themselves, but ${station.name} does`,
          at: `stations.${at}.passesTo`,
        };
      }
      if (!worked.has(to)) {
        return {
          reason: `must hand on to a station work is done at, but ${station.name} does not`,
          at: `stations.${at}.passesTo`,
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
        at: `reactions.${at}.to`,
      };
    }
    if (reaction.from !== null && !stationKeys.has(reaction.from)) {
      return {
        reason: `must wait for "${reaction.happening}" at a station on the line`,
        at: `reactions.${at}.from`,
      };
    }

    const standing = `${reaction.happening}@${reaction.from ?? '*'}`;

    if (claimed.has(standing)) {
      return {
        reason: `must send a happening to one station, but two wait for "${reaction.happening}"`,
        at: `reactions.${at}`,
      };
    }
    claimed.add(standing);
  }

  return null;
};
