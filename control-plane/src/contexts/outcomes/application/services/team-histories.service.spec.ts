import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import {
  MOST_RECORDS,
  TeamHistories,
} from '@outcomes/application/services/team-histories.service';
import type { RunRecord } from '@outcomes/domain/aggregates/run-record.aggregate';
import {
  ChatRecordsInMemory,
  chatOf,
  TaskFailuresInMemory,
  TaskTouchesInMemory,
} from '@outcomes/domain/insights.fake-spec';
import {
  endedRecord,
  FIRST_CONFIG,
  RunRecordsInMemory,
  SECOND_CONFIG,
  TaskDeliveriesInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { configChangesAlong } from '@outcomes/domain/services/config-stretches';
import { configMarkersOf } from '@outcomes/domain/services/daily-output';
import { within } from '@outcomes/domain/value-objects/insights-period.vo';
import { PersonPrincipal } from '@shared-kernel/domain/value-objects/principal.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:00:00.000Z');
const ADA = PersonPrincipal.of(UserId.of('user_ada'));

const historiesOver = async (
  runs: number,
  started = 0,
  more: readonly RunRecord[] = [],
  records = new RunRecordsInMemory(),
) => {
  const chats = new ChatRecordsInMemory();
  const start = new Date('2026-09-25T00:00:00.000Z').getTime();

  for (let at = 0; at < runs; at += 1) {
    await records.add(
      endedRecord(`run_${at}`, {
        taskId: `task_${at}`,
        endedAt: new Date(start + at * 1_000),
      }),
    );
  }

  for (const each of more) {
    await records.add(each);
  }

  for (let at = 0; at < started; at += 1) {
    await chats.add(
      chatOf(`chat_${at}`, 'user_ada', new Date(start + at * 1_000)),
    );
  }

  return new TeamHistories(
    new OutcomesAccess({
      clearedOnTeam: async () => ({
        workspaceId: WORKSPACE,
        by: UserId.of('user_ada'),
      }),
      namesOf: async () => new Map(),
    }),
    {
      records,
      deliveries: new TaskDeliveriesInMemory(),
      touches: new TaskTouchesInMemory(records),
      failures: new TaskFailuresInMemory(),
      chats,
    },
    { now: () => NOW, sleep: async () => {} },
  );
};

describe('TeamHistories', () => {
  it('counts every run while there are no more than it loads at once', async () => {
    const held = await (await historiesOver(3)).of('team_1', ADA, '7d');

    expect(held.truncated).toBe(false);
    expect(held.history.records).toHaveLength(3);
  });

  it('loads only the latest runs past its ceiling, and says it left the rest out', async () => {
    const held = await (await historiesOver(MOST_RECORDS + 1)).of(
      'team_1',
      ADA,
      '7d',
    );

    expect(held.truncated).toBe(true);
    expect(held.history.records).toHaveLength(MOST_RECORDS);
    expect(held.history.records[0]?.runId.value).toBe('run_1');
  });

  it('leaves out the runs that started earliest past its ceiling, so the runs it keeps follow on from each other in start order', async () => {
    const held = await (
      await historiesOver(MOST_RECORDS, 0, [
        endedRecord('run_long', {
          taskId: 'task_long',
          startedAt: new Date('2026-09-24T23:00:00.000Z'),
          endedAt: new Date('2026-09-30T00:00:00.000Z'),
        }),
      ])
    ).of('team_1', ADA, '7d');

    expect(held.truncated).toBe(true);
    expect(held.history.records).toHaveLength(MOST_RECORDS);
    expect(held.history.records.map((each) => each.runId.value)).not.toContain(
      'run_long',
    );
    expect(held.history.records[0]?.runId.value).toBe('run_0');
  });

  it('says it left some out when the team started more chats than it loads at once', async () => {
    const held = await (await historiesOver(3, MOST_RECORDS + 1)).of(
      'team_1',
      ADA,
      '7d',
    );

    expect(held.truncated).toBe(true);
    expect(held.history.records).toHaveLength(3);
    expect(held.history.chats).toHaveLength(MOST_RECORDS);
  });

  it('carries on from the last config run before the lookback at each station it ran at in it', async () => {
    const ranOn = (runId: string, day: string, stationId = 'station_1') =>
      endedRecord(runId, {
        taskId: `task_${runId}`,
        stationId,
        startedAt: new Date(`${day}T09:00:00.000Z`),
        endedAt: new Date(`${day}T10:00:00.000Z`),
      });
    const histories = await historiesOver(1, 0, [
      ranOn('run_older', '2026-07-01'),
      ranOn('run_last', '2026-07-02'),
      endedRecord('run_never_started', {
        taskId: 'task_never_started',
        ending: 'failed',
        endedAt: new Date('2026-07-03T10:00:00.000Z'),
      }),
      ranOn('run_quiet_station', '2026-07-02', 'station_quiet'),
    ]);
    const held = await histories.of('team_1', ADA, '7d');
    const carried = await histories.carriedOn(held);

    expect(held.runsFrom).toEqual(held.period.lookback.from);
    expect(carried.from).toEqual(held.period.lookback.from);
    expect(carried.lastRuns.map((each) => each.runId.value)).toEqual([
      'run_last',
    ]);
  });

  describe('past its ceiling', () => {
    const configRun = (
      runId: string,
      fingerprint: string,
      startedAt: string,
      endedAt = startedAt,
    ) =>
      endedRecord(runId, {
        taskId: `task_${runId}`,
        stationId: 'station_x',
        fingerprint,
        startedAt: new Date(startedAt),
        endedAt: new Date(endedAt),
      });

    const truncatedOver = async (more: readonly RunRecord[]) => {
      const records = new RunRecordsInMemory();
      const histories = await historiesOver(MOST_RECORDS, 0, more, records);
      const held = await histories.of('team_1', ADA, '7d');
      const carried = await histories.carriedOn(held);
      const markers = configMarkersOf(held.history, held.period, carried);
      const changes = configChangesAlong([...records.held.values()]).filter(
        ({ run }) =>
          run.stationId === 'station_x' &&
          run.beganAt.getTime() >= carried.from.getTime() &&
          within(held.period.current, run.beganAt),
      );

      expect(held.truncated).toBe(true);
      expect(markers.map((each) => each.runId)).toEqual(
        changes.map(({ run }) => run.runId.value),
      );

      return { held, carried, markers };
    };

    it('carries on from the last config run before the earliest run it keeps, so a change among the runs it left out marks no run it keeps', async () => {
      const { held, carried, markers } = await truncatedOver([
        configRun('run_old_a', FIRST_CONFIG, '2026-07-01T09:00:00.000Z'),
        configRun(
          'run_dropped_b',
          SECOND_CONFIG,
          '2026-09-24T22:00:00.000Z',
          '2026-09-24T23:00:00.000Z',
        ),
        configRun('run_kept_b', SECOND_CONFIG, '2026-09-30T09:00:00.000Z'),
      ]);

      expect(held.runsFrom).toEqual(
        new Date(new Date('2026-09-25T00:00:00.000Z').getTime() + 1_000),
      );
      expect(carried.lastRuns.map((each) => each.runId.value)).toEqual([
        'run_dropped_b',
      ]);
      expect(markers).toEqual([]);
    });

    it('still marks a change it keeps the run of, from the config of a run it left out', async () => {
      const { markers } = await truncatedOver([
        configRun('run_old_a', FIRST_CONFIG, '2026-07-01T09:00:00.000Z'),
        configRun(
          'run_dropped_b',
          SECOND_CONFIG,
          '2026-09-24T22:00:00.000Z',
          '2026-09-24T23:00:00.000Z',
        ),
        configRun('run_kept_a', FIRST_CONFIG, '2026-09-30T09:00:00.000Z'),
      ]);

      expect(markers).toMatchObject([
        {
          runId: 'run_kept_a',
          fingerprint: FIRST_CONFIG,
          previousFingerprint: SECOND_CONFIG,
        },
      ]);
    });

    it('leaves out every run that began at the instant of the last run it leaves out, so the runs it keeps start after all it left out', async () => {
      const records = new RunRecordsInMemory();
      const histories = await historiesOver(
        MOST_RECORDS - 1,
        0,
        [
          endedRecord('run_tied_a', {
            taskId: 'task_tied_a',
            endedAt: new Date('2026-09-24T12:00:00.000Z'),
          }),
          endedRecord('run_tied_b', {
            taskId: 'task_tied_b',
            endedAt: new Date('2026-09-24T12:00:00.000Z'),
          }),
        ],
        records,
      );
      const held = await histories.of('team_1', ADA, '7d');

      expect(held.truncated).toBe(true);
      expect(held.history.records).toHaveLength(MOST_RECORDS - 1);
      expect(
        held.history.records.map((each) => each.runId.value),
      ).not.toContain('run_tied_b');
      expect(held.runsFrom).toEqual(new Date('2026-09-25T00:00:00.000Z'));
    });
  });
});
