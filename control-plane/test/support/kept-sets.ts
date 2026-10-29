import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { WORK, type WorkPort } from '@replays/application/ports/work.port';
import { DrizzleReplaySetRepository } from '@replays/infrastructure/persistence/drizzle/repositories/replay-set.repository';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

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

  const ended: RunEndedIntegrationEvent = {
    kind: RUN_ENDED,
    runId,
    workspaceId: at.workspaceId,
    taskId: randomUUID(),
    stationId: at.stationId,
    outcome: 'completed',
    failure: null,
    stopped: false,
    asked: false,
  };

  await subscriber.handle(ended as unknown as DomainEvent);
};

const keptSetOf = async (
  app: INestApplication,
  at: KeptAt,
): Promise<string> => {
  await runEnded(app, at);

  const set = await app.get(DrizzleReplaySetRepository).ofStation(at.stationId);

  if (!set) {
    throw new Error(`Station ${at.stationId} has no kept replay set.`);
  }

  return set.id.value;
};

const excluded = new WeakMap<INestApplication, Map<string, Set<string>>>();

const excludedIn = (app: INestApplication): Map<string, Set<string>> => {
  const known = excluded.get(app);

  if (known) {
    return known;
  }

  const stations = new Map<string, Set<string>>();
  const work = app.get<WorkPort>(WORK);
  const recentAt = work.recentAt.bind(work);

  work.recentAt = async (workspaceId, stationId, max) => {
    const left = stations.get(stationId);
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

  const work = app.get<WorkPort>(WORK);
  const atStation = await work.recentAt(
    WorkspaceId.of(at.workspaceId),
    at.stationId,
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
    const set = await sets.ofStation(at.stationId);
    const locked = set && (await sets.locked(set.id));

    if (!locked) {
      throw new Error(`Station ${at.stationId} has no kept replay set.`);
    }

    const recent = await work.recentAt(
      locked.workspaceId,
      at.stationId,
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
          false,
        ),
      locked.refresh(
        {
          add: [],
          remove: locked.runs.filter(
            (each) => !wanted.some((run) => run.equals(each)),
          ),
        },
        new Date(start),
        false,
      ),
    );

    await sets.save(kept);
  });

  return setId;
};
