import { randomUUID } from 'node:crypto';
import {
  STATION_ALERT_FIRED,
  type StationAlertFiredIntegrationEvent,
} from '@shared-kernel/application/integration-events/station-alert-fired.integration-event';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { describe, expect, it } from 'vitest';
import { autoSearched } from './support/app';
import {
  activeSearchAt,
  dueNow,
  policyAt,
  scheduleOf,
} from './support/auto-searches';
import * as schema from './support/schema';
import {
  anOriginal,
  app,
  BUILD,
  createSet,
  db,
  delivered,
  drained,
  fiveTasks,
  openSearchFlow,
  owner,
  POLISH,
  replayEnded,
  searchedAt,
  searchOf,
  startSearch,
  stationPath,
  team,
  teamPath,
  tenTasks,
} from './support/search-flow';

openSearchFlow();

const HOUR_MS = 60 * 60 * 1000;

const stopped = async (searchId: string): Promise<void> => {
  await owner().post(`${teamPath()}/searches/${searchId}/stop`).expect(204);
};

const counted = async () => ({
  searches: (await db.select().from(schema.replaySearch)).length,
  searchReplays: (await db.select().from(schema.replay)).filter(
    (each) => each.searchId !== null,
  ).length,
});

describe('searches Spotlight starts on its own', () => {
  it('skips a set with too few tasks at no cost, and shows why on the set', async () => {
    const few = [];
    for (let each = 0; each < 3; each += 1) {
      few.push(await anOriginal());
    }
    await createSet(few);
    await policyAt(searchedAt(), { iterations: 1, ceiling: 20 });

    const before = await counted();

    await dueNow(searchedAt());
    await autoSearched(app);
    await dueNow(searchedAt());
    await autoSearched(app);

    expect(await counted()).toEqual(before);
    expect((await scheduleOf(searchedAt()))?.lastSkipReason).toBe(
      'set-too-small',
    );

    const set = (await owner().get(`${stationPath()}/replay-set`).expect(200))
      .body as {
      searchSchedule: {
        lastStartedAt: string | null;
        lastSkip: { reason: string } | null;
        checkAfter: string;
      };
    };

    expect(set.searchSchedule).toMatchObject({
      lastStartedAt: null,
      lastSkip: { reason: 'set-too-small' },
    });
    expect(Date.parse(set.searchSchedule.checkAfter)).toBeGreaterThan(
      Date.now() + 23 * HOUR_MS,
    );
  }, 120_000);

  it('starts one search across two stations of a line when the monthly ceiling fits only one, however the ticks overlap', async () => {
    const polished = [];
    for (let each = 0; each < 5; each += 1) {
      polished.push(await anOriginal(POLISH));
    }
    await createSet(fiveTasks);
    await createSet(polished, POLISH);
    await policyAt(
      searchedAt(),
      { iterations: 1, ceiling: 20 },
      { monthlyCeiling: 30 },
    );
    await policyAt(
      searchedAt(POLISH),
      { iterations: 1, ceiling: 20 },
      { monthlyCeiling: 30 },
    );
    await dueNow(searchedAt(), { lastStartedAt: null });
    await dueNow(searchedAt(POLISH), { lastStartedAt: null });

    await Promise.all([autoSearched(app), autoSearched(app)]);

    const started = [
      await activeSearchAt(searchedAt()),
      await activeSearchAt(searchedAt(POLISH)),
    ].filter((each) => each !== undefined);

    expect(started).toHaveLength(1);
    expect(
      [
        (await scheduleOf(searchedAt()))?.lastSkipReason,
        (await scheduleOf(searchedAt(POLISH)))?.lastSkipReason,
      ].filter((each) => each !== null),
    ).toEqual(['monthly-ceiling']);

    await stopped(started[0]?.id as string);
  }, 120_000);

  it('starts exactly one search when an alert fires on a station that is also due on schedule', async () => {
    await createSet(fiveTasks);
    await policyAt(searchedAt(), { iterations: 1, ceiling: 20 });
    await dueNow(searchedAt(), { lastStartedAt: null });
    await delivered({
      kind: STATION_ALERT_FIRED,
      alertId: randomUUID(),
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      stationId: BUILD,
    } as unknown as DomainEvent);

    await Promise.all([autoSearched(app), autoSearched(app)]);

    const active = (await db.select().from(schema.replaySearch)).filter(
      (each) =>
        each.stationId === BUILD &&
        ['seeding', 'searching', 'holding-out'].includes(each.state),
    );

    expect(active.map((each) => each.trigger)).toEqual(['alert']);

    await stopped(active[0]?.id as string);
  }, 120_000);

  it('starts a search when a station alert fires, once the cooldown ended, before the period ends', async () => {
    await createSet(fiveTasks);
    await policyAt(searchedAt(), { iterations: 1, ceiling: 20 });
    await dueNow(searchedAt(), {
      lastStartedAt: new Date(Date.now() - 2 * HOUR_MS),
    });
    await autoSearched(app);

    expect(await activeSearchAt(searchedAt())).toBeUndefined();

    const fired: StationAlertFiredIntegrationEvent = {
      kind: STATION_ALERT_FIRED,
      alertId: randomUUID(),
      workspaceId: team.workspaceId.value,
      teamId: team.teamId.value,
      stationId: BUILD,
    };

    await delivered(fired as unknown as DomainEvent);

    const alerted = await scheduleOf(searchedAt());

    expect(alerted?.alertPendingSince).not.toBeNull();
    expect(alerted?.checkAfter.getTime()).toBeLessThanOrEqual(Date.now());

    await autoSearched(app);

    const started = await activeSearchAt(searchedAt());

    expect(started?.trigger).toBe('alert');
    expect((await scheduleOf(searchedAt()))?.alertPendingSince).toBeNull();
    expect((await searchOf(started?.id as string)).trigger).toBe('alert');

    await stopped(started?.id as string);
  }, 120_000);

  it('never holds out a task that an earlier automatic search of the station searched on', async () => {
    await createSet(tenTasks);

    const first = await startSearch({ iterations: 1, ceiling: 20 });
    const firstRead = await searchOf(first.id);

    await stopped(first.id);

    const second = await startSearch({ iterations: 1, ceiling: 20 });
    const secondRead = await searchOf(second.id);
    const searchedFirst = new Set(
      firstRead.split.searched.map((each) => each.taskId),
    );

    expect(secondRead.split.heldOut.length).toBeGreaterThanOrEqual(2);
    expect(
      secondRead.split.heldOut.filter((each) => searchedFirst.has(each.taskId)),
    ).toEqual([]);
    expect((await scheduleOf(searchedAt()))?.searchedTasks).toEqual(
      expect.arrayContaining([
        ...searchedFirst,
        ...secondRead.split.searched.map((each) => each.taskId),
      ]),
    );

    await stopped(second.id);
  }, 120_000);

  it('stops starting searches once one more could pass the monthly ceiling of the line', async () => {
    await createSet(fiveTasks);

    const spending = await startSearch({ iterations: 1, ceiling: 20 });

    await drained(() => ({ score: 4, cost: 0.1 }));
    expect(await replayEnded(spending.seedReplayId)).toBe('finished');
    await stopped(spending.id);

    await policyAt(
      searchedAt(),
      { iterations: 1, ceiling: 20 },
      { monthlyCeiling: 20 },
    );
    await dueNow(searchedAt(), { lastStartedAt: null });

    const before = await counted();

    await autoSearched(app);

    expect(await counted()).toEqual(before);
    expect((await scheduleOf(searchedAt()))?.lastSkipReason).toBe(
      'monthly-ceiling',
    );
    expect((await scheduleOf(searchedAt()))?.checkAfter.getUTCDate()).toBe(1);
  }, 120_000);
});
