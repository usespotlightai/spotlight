import { stationConfigPullRequestsInMemory } from '@outcomes/application/ports/station-config-pull-requests.fake-spec';
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
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
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

const THIRD_CONFIG = 'c'.repeat(64);
const UNKNOWN_CONFIG = 'd'.repeat(64);

const CONFIGS: Record<string, StationConfigView> = {
  [FIRST_CONFIG]: configOf('sonnet'),
  [SECOND_CONFIG]: configOf('opus'),
  [THIRD_CONFIG]: configOf('haiku'),
};

const listing = async (member = true) => {
  const records = new RunRecordsInMemory();
  const deliveries = new TaskDeliveriesInMemory();
  const pullRequests = stationConfigPullRequestsInMemory();
  const asked: string[][] = [];
  const work: WorkPort = {
    endedRun: async () => null,
    teamRepositories: async () => [],
    teamSkillKeys: async () => [],
    alertsAt: async () => null,
    configsInOrder: async (fingerprints) => {
      asked.push([...fingerprints]);
      const known = fingerprints.filter((each) => each in CONFIGS);

      return known.map(
        (fingerprint, index): ConfigInOrder => ({
          fingerprint,
          config: CONFIGS[fingerprint] as StationConfigView,
          changes:
            index === 0 || known[index - 1] === fingerprint
              ? []
              : [
                  {
                    part: 'model',
                    name: null,
                    kind: 'changed',
                    was: CONFIGS[known[index - 1] ?? '']?.model ?? null,
                    now: CONFIGS[fingerprint]?.model ?? null,
                  },
                ],
        }),
      );
    },
  };
  const access = new OutcomesAccess({
    ...NOBODY_ELSE,
    membershipOnTeam: async () =>
      member ? { workspaceId: WORKSPACE, by: UserId.of('user_ada') } : null,
  });

  return {
    records,
    deliveries,
    pullRequests,
    asked,
    list: (last: number | null = null, stationId = 'station_1') =>
      new ListStationOutcomesHandler(
        access,
        records,
        deliveries,
        pullRequests,
        work,
      ).execute(
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
      endedRecord('run_1', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
      }),
    );
    await listed.records.add(
      endedRecord('run_2', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(2),
        endedAt: at(2),
      }),
    );
    await listed.records.add(
      endedRecord('run_3', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(3),
        endedAt: at(3),
        ending: 'failed',
      }),
    );
    await listed.records.add(
      endedRecord('run_4', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(4),
        endedAt: at(4),
      }),
    );

    const outcomes = await listed.list();

    expect(listed.asked).toEqual([
      [FIRST_CONFIG, FIRST_CONFIG, SECOND_CONFIG, SECOND_CONFIG, FIRST_CONFIG],
    ]);
    expect(outcomes.groups.every((group) => group.ran)).toBe(true);
    expect(
      outcomes.groups.map((group) => ({
        firstRunId: group.firstRunId,
        fingerprint: group.fingerprint,
        model: group.config?.model,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => each.runId),
        failed: group.tally.failed,
      })),
    ).toEqual([
      {
        firstRunId: 'run_4',
        fingerprint: FIRST_CONFIG,
        model: 'sonnet',
        changes: [['opus', 'sonnet']],
        runs: ['run_4'],
        failed: 0,
      },
      {
        firstRunId: 'run_2',
        fingerprint: SECOND_CONFIG,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: ['run_3', 'run_2'],
        failed: 1,
      },
      {
        firstRunId: 'run_1',
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
      TaskDelivery.open({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest,
        at: at(4),
      }).close({ pullRequest, merged: true, at: at(5) }),
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

  it('shows withdrawn runs of the config in force in the group in force, but tallies them apart', async () => {
    const listed = await listing();
    await listed.records.add(
      endedRecord('run_1', { startedAt: at(1), endedAt: at(1) }),
    );
    await listed.records.add(
      endedRecord('run_2', {
        fingerprint: FIRST_CONFIG,
        endedAt: at(2),
        ending: 'withdrawn',
      }),
    );

    const { groups } = await listed.list();
    const [group] = groups;

    expect(groups).toHaveLength(1);
    expect(group?.firstRunId).toBe('run_1');
    expect(group?.fingerprint).toBe(FIRST_CONFIG);
    expect(group?.ran).toBe(true);

    expect(group?.runs.map((each) => each.ending)).toEqual([
      'withdrawn',
      'completed',
    ]);
    expect(group?.tally).toMatchObject({ runs: 1, withdrawn: 1 });
  });

  it('keeps runs meant for a config that never ran apart from the group in force, set against it, and shows the group in force again after them, A, B never ran, A', async () => {
    const listed = await listing();
    await listed.records.add(
      endedRecord('run_1', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
      }),
    );
    for (const [runId, hour] of [
      ['run_b1', 2],
      ['run_b2', 3],
    ] as const) {
      await listed.records.add(
        endedRecord(runId, {
          fingerprint: SECOND_CONFIG,
          endedAt: at(hour),
          ending: 'failed',
          failure: 'provisioning',
        }),
      );
    }
    await listed.records.add(
      endedRecord('run_2', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(4),
        endedAt: at(4),
      }),
    );

    const outcomes = await listed.list();

    expect(
      outcomes.groups.map((group) => ({
        firstRunId: group.firstRunId,
        fingerprint: group.fingerprint,
        ran: group.ran,
        model: group.config?.model,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => each.runId),
        failed: group.tally.failed,
      })),
    ).toEqual([
      {
        firstRunId: 'run_2',
        fingerprint: FIRST_CONFIG,
        ran: true,
        model: 'sonnet',
        changes: [],
        runs: ['run_2'],
        failed: 0,
      },
      {
        firstRunId: 'run_b1',
        fingerprint: SECOND_CONFIG,
        ran: false,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: ['run_b2', 'run_b1'],
        failed: 2,
      },
      {
        firstRunId: 'run_1',
        fingerprint: FIRST_CONFIG,
        ran: true,
        model: 'sonnet',
        changes: [],
        runs: ['run_1'],
        failed: 0,
      },
    ]);
  });

  it('tallies the config in force over both its groups and none of the config that never ran between, A, B never ran, A', async () => {
    const listed = await listing();
    await listed.records.add(
      costedRecord('run_a1', {
        taskId: 'task_a1',
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
        amount: 0.25,
        ms: 10_000,
      }),
    );
    await listed.records.add(
      costedRecord('run_b', {
        taskId: 'task_b',
        fingerprint: SECOND_CONFIG,
        endedAt: at(2),
        ending: 'failed',
        failure: 'provisioning',
        amount: 4,
        ms: 1_000,
      }),
    );
    await listed.records.add(
      costedRecord('run_a2', {
        taskId: 'task_a2',
        fingerprint: FIRST_CONFIG,
        startedAt: at(3),
        endedAt: at(3),
        amount: 0.5,
        ms: 30_000,
      }),
    );
    await listed.records.add(
      costedRecord('run_a3', {
        taskId: 'task_a3',
        fingerprint: FIRST_CONFIG,
        startedAt: at(4),
        endedAt: at(4),
        amount: 0.75,
        ms: 20_000,
      }),
    );
    for (const [taskId, number] of [
      ['task_a1', 1],
      ['task_b', 2],
    ] as const) {
      const pullRequest = PullRequestUrl.of(
        `https://github.com/acme/api/pull/${number}`,
      );
      await listed.deliveries.add(
        TaskDelivery.open({
          taskId: TaskId.of(taskId),
          workspaceId: WORKSPACE,
          teamId: TEAM,
          pullRequest,
          at: at(5),
        }).close({ pullRequest, merged: true, at: at(6) }),
      );
    }

    const outcomes = await listed.list();

    expect(
      outcomes.groups.map((group) => [group.fingerprint, group.ran]),
    ).toEqual([
      [FIRST_CONFIG, true],
      [SECOND_CONFIG, false],
      [FIRST_CONFIG, true],
    ]);
    expect(outcomes.inForce).toEqual({
      tally: expect.objectContaining({
        runs: 3,
        withdrawn: 0,
        failed: 0,
        merged: 1,
        cost: { amount: 1.5, currency: 'USD' },
        medianMs: 20_000,
      }),
    });
  });

  it('sets each group only against the config before it, showing no changes where either is not on record, A, B not on record, C', async () => {
    const listed = await listing();
    for (const [runId, fingerprint, hour] of [
      ['run_1', FIRST_CONFIG, 1],
      ['run_2', UNKNOWN_CONFIG, 2],
      ['run_3', THIRD_CONFIG, 3],
    ] as const) {
      await listed.records.add(
        endedRecord(runId, {
          fingerprint,
          startedAt: at(hour),
          endedAt: at(hour),
        }),
      );
    }

    const outcomes = await listed.list();

    expect(
      outcomes.groups.map((group) => ({
        firstRunId: group.firstRunId,
        model: group.config?.model ?? null,
        changes: group.changes,
      })),
    ).toEqual([
      { firstRunId: 'run_3', model: 'haiku', changes: [] },
      { firstRunId: 'run_2', model: null, changes: [] },
      { firstRunId: 'run_1', model: 'sonnet', changes: [] },
    ]);
  });

  it('lists the latest-started runs, not the latest-ended, and carries on from before the oldest by start, telling runs that started at the same instant apart by run', async () => {
    const listed = await listing();
    await listed.records.add(
      endedRecord('run_long', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(9),
      }),
    );
    await listed.records.add(
      endedRecord('run_x', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(2),
        endedAt: at(2),
      }),
    );
    await listed.records.add(
      endedRecord('run_y', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(2),
        endedAt: at(3),
      }),
    );

    const outcomes = await listed.list(1);

    expect(
      outcomes.groups.map((group) => ({
        firstRunId: group.firstRunId,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => each.runId),
      })),
    ).toEqual([
      {
        firstRunId: 'run_y',
        changes: [['sonnet', 'opus']],
        runs: ['run_y'],
      },
    ]);
    expect(
      (await listed.list(2)).groups.map((group) =>
        group.runs.map((each) => each.runId),
      ),
    ).toEqual([['run_y'], ['run_x']]);
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

  it('shows the latest pull request Spotlight opened proposing each group’s config at the station, and none where it opened none', async () => {
    const listed = await listing();
    const opened = (
      id: string,
      fingerprint: string,
      openedAt: Date,
      change: { stationId?: string; teamId?: TeamId } = {},
    ) =>
      listed.pullRequests.note({
        configPullRequestId: id,
        workspaceId: WORKSPACE,
        teamId: change.teamId ?? TEAM,
        stationId: change.stationId ?? 'station_1',
        fingerprint,
        url: PullRequestUrl.of(`https://github.com/acme/platform/pull/${id}`),
        openedAt,
      });
    await listed.records.add(
      endedRecord('run_1', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
      }),
    );
    await listed.records.add(
      endedRecord('run_2', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(2),
        endedAt: at(2),
      }),
    );
    await opened('7', SECOND_CONFIG, at(1));
    await opened('8', SECOND_CONFIG, at(3));
    await opened('9', SECOND_CONFIG, at(2));
    await opened('10', FIRST_CONFIG, at(1), { stationId: 'station_2' });
    await opened('11', FIRST_CONFIG, at(1), { teamId: TeamId.of('team_2') });

    const outcomes = await listed.list();

    expect(
      outcomes.groups.map((group) => [group.fingerprint, group.pullRequest]),
    ).toEqual([
      [SECOND_CONFIG, { url: 'https://github.com/acme/platform/pull/8' }],
      [FIRST_CONFIG, null],
    ]);
  });

  it('keeps runs that ran no config before any that did in a group without a config', async () => {
    const listed = await listing();
    await listed.records.add(
      endedRecord('run_1', { fingerprint: null, startedAt: at(1) }),
    );

    const outcomes = await listed.list();

    expect(outcomes.groups[0]?.firstRunId).toBe('run_1');
    expect(outcomes.groups[0]?.fingerprint).toBeNull();
    expect(outcomes.groups[0]?.config).toBeNull();
    expect(listed.asked).toEqual([[]]);
  });

  it('carries on the config of the station’s last config run before the oldest listed run, setting the oldest group against it', async () => {
    const listed = await listing();
    await listed.records.add(
      endedRecord('run_0', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
      }),
    );
    await listed.records.add(
      endedRecord('run_withdrawn', {
        fingerprint: FIRST_CONFIG,
        endedAt: at(2),
        ending: 'withdrawn',
      }),
    );
    await listed.records.add(
      endedRecord('run_1', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(3),
        endedAt: at(3),
      }),
    );
    await listed.records.add(
      endedRecord('run_2', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(4),
        endedAt: at(4),
      }),
    );
    const shapeOf = (outcomes: Awaited<ReturnType<typeof listed.list>>) =>
      outcomes.groups.map((group) => ({
        firstRunId: group.firstRunId,
        fingerprint: group.fingerprint,
        model: group.config?.model,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => each.runId),
      }));

    expect(shapeOf(await listed.list(3))).toEqual([
      {
        firstRunId: 'run_1',
        fingerprint: SECOND_CONFIG,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: ['run_2', 'run_1'],
      },
      {
        firstRunId: 'run_withdrawn',
        fingerprint: FIRST_CONFIG,
        model: 'sonnet',
        changes: [],
        runs: ['run_withdrawn'],
      },
    ]);
    expect(shapeOf(await listed.list(2))).toEqual([
      {
        firstRunId: 'run_1',
        fingerprint: SECOND_CONFIG,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: ['run_2', 'run_1'],
      },
    ]);
    expect(shapeOf(await listed.list(1))).toEqual([
      {
        firstRunId: 'run_2',
        fingerprint: SECOND_CONFIG,
        model: 'opus',
        changes: [],
        runs: ['run_2'],
      },
    ]);
    expect(listed.asked).toEqual([
      [FIRST_CONFIG, FIRST_CONFIG, SECOND_CONFIG],
      [FIRST_CONFIG, SECOND_CONFIG],
      [SECOND_CONFIG],
    ]);
  });

  it('finds no team for someone not on it', async () => {
    const listed = await listing(false);

    await expect(listed.list()).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(listed.list()).rejects.toBeInstanceOf(ApplicationError);
  });
});
