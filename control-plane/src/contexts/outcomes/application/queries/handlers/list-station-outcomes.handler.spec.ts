import type {
  ConfigInOrder,
  StationConfigView,
  WorkPort,
} from '@outcomes/application/ports/work.port';
import { ListStationOutcomesHandler } from '@outcomes/application/queries/handlers/list-station-outcomes.handler';
import { ListStationOutcomesQuery } from '@outcomes/application/queries/list-station-outcomes.query';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { TaskDelivery } from '@outcomes/domain/aggregates/task-delivery.aggregate';
import {
  costedRecord,
  endedRecord,
  FIRST_CONFIG,
  NOBODY_ELSE,
  RunRecordsInMemory,
  SECOND_CONFIG,
  TaskDeliveriesInMemory,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const at = (hour: number) =>
  new Date(`2026-09-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

const configOf = (model: string): StationConfigView => ({
  prompt: null,
  harness: 'claude-code',
  model,
  effort: null,
  profile: null,
  image: null,
  repositories: [],
  skills: [],
  tools: [],
  decisions: false,
  memories: false,
});

const CONFIGS: Record<string, StationConfigView> = {
  [FIRST_CONFIG]: configOf('sonnet'),
  [SECOND_CONFIG]: configOf('opus'),
};

const listing = async (member = true) => {
  const records = new RunRecordsInMemory();
  const deliveries = new TaskDeliveriesInMemory();
  const asked: string[][] = [];
  const work: WorkPort = {
    endedRun: async () => null,
    configsInOrder: async (fingerprints) => {
      asked.push([...fingerprints]);
      return fingerprints.map(
        (fingerprint, index): ConfigInOrder => ({
          fingerprint,
          config: CONFIGS[fingerprint] ?? configOf('unknown'),
          changes:
            index === 0
              ? []
              : [
                  {
                    part: 'model',
                    name: null,
                    kind: 'changed',
                    was: CONFIGS[fingerprints[index - 1] ?? '']?.model ?? null,
                    now: CONFIGS[fingerprint]?.model ?? null,
                  },
                ],
        }),
      );
    },
  };
  const access = new OutcomesAccess({
    ...NOBODY_ELSE,
    clearedOnTeam: async () =>
      member ? { workspaceId: WORKSPACE, by: UserId.of('user_ada') } : null,
  });

  return {
    records,
    deliveries,
    asked,
    list: (last: number | null = null, stationId = 'station_1') =>
      new ListStationOutcomesHandler(access, records, deliveries, work).execute(
        new ListStationOutcomesQuery(
          'team_1',
          'line_1',
          stationId,
          'user_ada',
          last,
        ),
      ),
  };
};

describe('listing how a station’s runs turned out', () => {
  it('groups the latest runs by config, the newest first, each with how its config changed', async () => {
    const listed = await listing();
    await listed.records.add(
      endedRecord('run_1', { fingerprint: FIRST_CONFIG, endedAt: at(1) }),
    );
    await listed.records.add(
      endedRecord('run_2', { fingerprint: SECOND_CONFIG, endedAt: at(2) }),
    );
    await listed.records.add(
      endedRecord('run_3', {
        fingerprint: SECOND_CONFIG,
        endedAt: at(3),
        ending: 'failed',
      }),
    );
    await listed.records.add(
      endedRecord('run_4', { fingerprint: FIRST_CONFIG, endedAt: at(4) }),
    );

    const outcomes = await listed.list();

    expect(listed.asked).toEqual([[FIRST_CONFIG, SECOND_CONFIG, FIRST_CONFIG]]);
    expect(
      outcomes.groups.map((group) => ({
        fingerprint: group.fingerprint,
        model: group.config?.model,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => each.runId),
        failed: group.tally.failed,
      })),
    ).toEqual([
      {
        fingerprint: FIRST_CONFIG,
        model: 'sonnet',
        changes: [['opus', 'sonnet']],
        runs: ['run_4'],
        failed: 0,
      },
      {
        fingerprint: SECOND_CONFIG,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: ['run_3', 'run_2'],
        failed: 1,
      },
      {
        fingerprint: FIRST_CONFIG,
        model: 'sonnet',
        changes: [],
        runs: ['run_1'],
        failed: 0,
      },
    ]);
  });

  it('shows each run with its task’s delivery', async () => {
    const listed = await listing();
    await listed.records.add(endedRecord('run_1'));
    const pullRequest = PullRequestUrl.of('https://github.com/acme/api/pull/1');
    await listed.deliveries.add(
      TaskDelivery.opened({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest,
        at: at(4),
      }).closed({ pullRequest, merged: true, at: at(5) }),
    );

    const outcomes = await listed.list();

    expect(outcomes.groups[0]?.runs[0]?.delivery).toBe('merged');
    expect(outcomes.groups[0]?.tally.merged).toBe(1);
  });

  it('shows and tallies the cost each run’s record keeps', async () => {
    const listed = await listing();
    await listed.records.add(
      costedRecord('run_1', { endedAt: at(1), amount: 0.25 }),
    );
    await listed.records.add(
      costedRecord('run_2', { endedAt: at(2), amount: 0.25 }),
    );
    await listed.records.add(endedRecord('run_3', { endedAt: at(3) }));

    const outcomes = await listed.list();

    expect(outcomes.groups[0]?.runs[0]?.cost).toBeNull();
    expect(outcomes.groups[0]?.runs[1]?.cost?.cost).toBe(0.25);
    expect(outcomes.groups[0]?.tally.cost).toEqual({
      amount: 0.5,
      currency: 'USD',
    });
  });

  it('shows withdrawn runs but tallies them apart', async () => {
    const listed = await listing();
    await listed.records.add(endedRecord('run_1', { endedAt: at(1) }));
    await listed.records.add(
      endedRecord('run_2', { endedAt: at(2), ending: 'withdrawn' }),
    );

    const [group] = (await listed.list()).groups;

    expect(group?.runs.map((each) => each.ending)).toEqual([
      'withdrawn',
      'completed',
    ]);
    expect(group?.tally).toMatchObject({ runs: 1, withdrawn: 1 });
  });

  it('looks at only as many of the latest runs as asked', async () => {
    const listed = await listing();
    for (const hour of [1, 2, 3]) {
      await listed.records.add(
        endedRecord(`run_${hour}`, { endedAt: at(hour) }),
      );
    }

    const outcomes = await listed.list(2);

    expect(outcomes.groups[0]?.runs.map((each) => each.runId)).toEqual([
      'run_3',
      'run_2',
    ]);
  });

  it('shows only the asked station’s runs', async () => {
    const listed = await listing();
    await listed.records.add(endedRecord('run_1', { stationId: 'station_2' }));

    expect((await listed.list()).groups).toEqual([]);
  });

  it('keeps runs from before configs were fingerprinted, without a config', async () => {
    const listed = await listing();
    await listed.records.add(endedRecord('run_1', { fingerprint: null }));

    const outcomes = await listed.list();

    expect(outcomes.groups[0]?.fingerprint).toBeNull();
    expect(outcomes.groups[0]?.config).toBeNull();
    expect(listed.asked).toEqual([[]]);
  });

  it('finds no team for someone not on it', async () => {
    const listed = await listing(false);

    await expect(listed.list()).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(listed.list()).rejects.toBeInstanceOf(UseCaseFault);
  });
});
