import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import { EventSubscribers } from '@platform/events/event-subscribers';
import {
  TRIALABLE_RUNS as REPLAYS_TRIALABLE_RUNS,
  type TrialableRunsPort as ReplaysTrialableRunsPort,
} from '@replays/application/ports/trialable-runs.port';
import { SetUsers } from '@replays/domain/value-objects/set-users.vo';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import { DrizzleStationSearchScheduleRepository } from '@replays/infrastructure/persistence/drizzle/repositories/station-search-schedule.repository';
import {
  DISPATCH_ENDED,
  type DispatchEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/dispatch-ended.integration-event';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

import { eventually } from './eventually';

interface KeptAt {
  readonly workspaceId: string;
  readonly stationId: string;
}

const MOST_RECENT = 1_000;

const KEEP_SET_SUBSCRIBER = 'replays.keep-replay-set-of-station';

export const runEnded = async (
  app: INestApplication,
  at: KeptAt,
  runId: string = randomUUID(),
): Promise<void> => {
  const subscriber = app.get(EventSubscribers).named(KEEP_SET_SUBSCRIBER);

  if (!subscriber) {
    throw new Error(`No subscriber is called ${KEEP_SET_SUBSCRIBER}.`);
  }

  const ended: DispatchEndedIntegrationEvent = {
    kind: DISPATCH_ENDED,
    runId,
    workspaceId: at.workspaceId,
    taskId: randomUUID(),
    stationId: at.stationId,
    outcome: 'completed',
    failure: null,
    stopped: false,
    asked: false,
  };

  await subscriber.handle(ended);
};

const keptSetOf = async (
  app: INestApplication,
  at: KeptAt,
): Promise<string> => {
  await runEnded(app, at);

  const set = await app
    .get(DrizzleReplaySetRepository)
    .ofStation(StationId.of(at.stationId));

  if (!set) {
    throw new Error(`Station ${at.stationId} has no kept replay set.`);
  }

  await eventually(() =>
    app.get(DrizzleStationSearchScheduleRepository).ofSet(set.id),
  );

  return set.id.value;
};

const excluded = new WeakMap<INestApplication, Map<string, Set<string>>>();

const excludedIn = (app: INestApplication): Map<string, Set<string>> => {
  const known = excluded.get(app);

  if (known) {
    return known;
  }

  const stations = new Map<string, Set<string>>();
  const trialableRuns = app.get<ReplaysTrialableRunsPort>(
    REPLAYS_TRIALABLE_RUNS,
  );
  const recentAt = trialableRuns.recentAt.bind(trialableRuns);

  trialableRuns.recentAt = async (workspaceId, stationId, max) => {
    const left = stations.get(stationId.value);
    const recent = await recentAt(workspaceId, stationId, max);

    return left ? recent.filter((each) => !left.has(each.runId.value)) : recent;
  };
  excluded.set(app, stations);

  return stations;
};

export const keptSet = async (
  app: INestApplication,
  at: KeptAt,
  runs: readonly string[],
): Promise<string> => {
  const stations = excludedIn(app);

  stations.delete(at.stationId);

  const trialableRuns = app.get<ReplaysTrialableRunsPort>(
    REPLAYS_TRIALABLE_RUNS,
  );
  const atStation = await trialableRuns.recentAt(
    WorkspaceId.of(at.workspaceId),
    StationId.of(at.stationId),
    MOST_RECENT,
  );

  stations.set(
    at.stationId,
    new Set(
      atStation
        .map((each) => each.runId.value)
        .filter((each) => !runs.includes(each)),
    ),
  );

  const setId = await keptSetOf(app, at);
  const sets = app.get(DrizzleReplaySetRepository);
  const wanted = runs.map((each) => RunId.of(each));

  await app.get<TransactionPort>(TRANSACTION).inTransaction(async () => {
    const set = await sets.ofStation(StationId.of(at.stationId));
    const locked = set && (await sets.locked(set.id));

    if (!locked) {
      throw new Error(`Station ${at.stationId} has no kept replay set.`);
    }

    const recent = await trialableRuns.recentAt(
      locked.workspaceId,
      StationId.of(at.stationId),
      MOST_RECENT,
    );
    const replayable = recent.filter((each) =>
      wanted.some((run) => run.equals(each.runId) && !locked.includes(run)),
    );
    const start = Date.now();
    const ordered = [...replayable].sort(
      (one, other) =>
        runs.indexOf(one.runId.value) - runs.indexOf(other.runId.value),
    );
    const kept = ordered.reduce(
      (set, each, index) =>
        set.refresh(
          { add: [each], remove: [] },
          new Date(start + index + 1),
          SetUsers.none(),
        ),
      locked.refresh(
        {
          add: [],
          remove: locked.runs.filter(
            (each) => !wanted.some((run) => run.equals(each)),
          ),
        },
        new Date(start),
        SetUsers.none(),
      ),
    );

    await sets.save(kept);
  });

  return setId;
};
