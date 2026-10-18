import { stationConfigPullRequestsInMemory } from '@insights/application/ports/station-config-pull-requests.fake-spec';
import type {
  ConfigInOrder,
  StationConfigView,
  WorkPort,
} from '@insights/application/ports/work.port';
import { ReadStationInsightsHandler } from '@insights/application/queries/handlers/read-station-insights.handler';
import { ReadStationInsightsQuery } from '@insights/application/queries/read-station-insights.query';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { TaskPullRequest } from '@insights/domain/aggregates/task-pull-request.aggregate';
import {
  costedRecord,
  endedRecord,
  FIRST_CONFIG,
  NOBODY_ELSE,
  RunRecordsInMemory,
  SECOND_CONFIG,
  TaskPullRequestsInMemory,
  TEAM,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
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

const reading = async (member = true) => {
  const records = new RunRecordsInMemory();
  const taskPullRequests = new TaskPullRequestsInMemory();
  const pullRequests = stationConfigPullRequestsInMemory();
  const requested: string[][] = [];
  const work: WorkPort = {
    endedRun: async () => null,
    teamRepositories: async () => [],
    teamSkillKeys: async () => [],
    alertsAt: async () => null,
    configsInOrder: async (fingerprints) => {
      requested.push([...fingerprints]);
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
  const access = new InsightsAccess({
    ...NOBODY_ELSE,
    membershipOnTeam: async () =>
      member ? { workspaceId: WORKSPACE, by: UserId.of('user_ada') } : null,
  });

  return {
    records,
    taskPullRequests,
    pullRequests,
    requested,
    read: (last: number | null = null, stationId = 'station_1') =>
      new ReadStationInsightsHandler(
        access,
        records,
        taskPullRequests,
        pullRequests,
        work,
      ).execute(
        new ReadStationInsightsQuery(
          'team_1',
          'line_1',
          stationId,
          'user_ada',
          last,
        ),
      ),
  };
};

describe('reading how a station’s runs turned out', () => {
  it('groups the latest runs by config, the newest first, each with how its config changed', async () => {
    const reader = await reading();
    await reader.records.add(
      endedRecord('run_1', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
      }),
    );
    await reader.records.add(
      endedRecord('run_2', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(2),
        endedAt: at(2),
      }),
    );
    await reader.records.add(
      endedRecord('run_3', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(3),
        endedAt: at(3),
        ending: 'failed',
      }),
    );
    await reader.records.add(
      endedRecord('run_4', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(4),
        endedAt: at(4),
      }),
    );

    const insights = await reader.read();

    expect(reader.requested).toEqual([
      [FIRST_CONFIG, FIRST_CONFIG, SECOND_CONFIG, SECOND_CONFIG, FIRST_CONFIG],
    ]);
    expect(insights.groups.every((group) => group.ran)).toBe(true);
    expect(
      insights.groups.map((group) => ({
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

  it('shows each run with the state of its task’s pull request', async () => {
    const reader = await reading();
    await reader.records.add(endedRecord('run_1'));
    const pullRequest = PullRequestUrl.of('https://github.com/acme/api/pull/1');
    await reader.taskPullRequests.add(
      TaskPullRequest.open({
        taskId: TaskId.of('task_1'),
        workspaceId: WORKSPACE,
        teamId: TEAM,
        pullRequest,
        at: at(4),
      }).close({ pullRequest, merged: true, at: at(5) }),
    );

    const insights = await reader.read();

    expect(insights.groups[0]?.runs[0]?.pullRequestState).toBe('merged');
    expect(insights.groups[0]?.tally.merged).toBe(1);
  });

  it('shows and tallies the cost each run’s record keeps', async () => {
    const reader = await reading();
    await reader.records.add(
      costedRecord('run_1', { endedAt: at(1), amount: 0.25 }),
    );
    await reader.records.add(
      costedRecord('run_2', { endedAt: at(2), amount: 0.25 }),
    );
    await reader.records.add(endedRecord('run_3', { endedAt: at(3) }));

    const insights = await reader.read();

    expect(insights.groups[0]?.runs[0]?.usage).toBeNull();
    expect(insights.groups[0]?.runs[1]?.usage?.cost).toBe(0.25);
    expect(insights.groups[0]?.tally.cost).toEqual({
      amount: 0.5,
      currency: 'USD',
    });
  });

  it('shows cancelled runs of the config in force in the group in force, but tallies them apart', async () => {
    const reader = await reading();
    await reader.records.add(
      endedRecord('run_1', { startedAt: at(1), endedAt: at(1) }),
    );
    await reader.records.add(
      endedRecord('run_2', {
        fingerprint: FIRST_CONFIG,
        endedAt: at(2),
        ending: 'cancelled',
      }),
    );

    const { groups } = await reader.read();
    const [group] = groups;

    expect(groups).toHaveLength(1);
    expect(group?.firstRunId).toBe('run_1');
    expect(group?.fingerprint).toBe(FIRST_CONFIG);
    expect(group?.ran).toBe(true);

    expect(group?.runs.map((each) => each.ending)).toEqual([
      'cancelled',
      'completed',
    ]);
    expect(group?.tally).toMatchObject({ runs: 1, cancelled: 1 });
  });

  it('keeps runs meant for a config that never ran apart from the group in force, set against it, and shows the group in force again after them, A, B never ran, A', async () => {
    const reader = await reading();
    await reader.records.add(
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
      await reader.records.add(
        endedRecord(runId, {
          fingerprint: SECOND_CONFIG,
          endedAt: at(hour),
          ending: 'failed',
          failure: 'provisioning',
        }),
      );
    }
    await reader.records.add(
      endedRecord('run_2', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(4),
        endedAt: at(4),
      }),
    );

    const insights = await reader.read();

    expect(
      insights.groups.map((group) => ({
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
    const reader = await reading();
    await reader.records.add(
      costedRecord('run_a1', {
        taskId: 'task_a1',
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
        amount: 0.25,
        ms: 10_000,
      }),
    );
    await reader.records.add(
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
    await reader.records.add(
      costedRecord('run_a2', {
        taskId: 'task_a2',
        fingerprint: FIRST_CONFIG,
        startedAt: at(3),
        endedAt: at(3),
        amount: 0.5,
        ms: 30_000,
      }),
    );
    await reader.records.add(
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
      await reader.taskPullRequests.add(
        TaskPullRequest.open({
          taskId: TaskId.of(taskId),
          workspaceId: WORKSPACE,
          teamId: TEAM,
          pullRequest,
          at: at(5),
        }).close({ pullRequest, merged: true, at: at(6) }),
      );
    }

    const insights = await reader.read();

    expect(
      insights.groups.map((group) => [group.fingerprint, group.ran]),
    ).toEqual([
      [FIRST_CONFIG, true],
      [SECOND_CONFIG, false],
      [FIRST_CONFIG, true],
    ]);
    expect(insights.inForce).toEqual({
      tally: expect.objectContaining({
        runs: 3,
        cancelled: 0,
        failed: 0,
        merged: 1,
        cost: { amount: 1.5, currency: 'USD' },
        medianMs: 20_000,
      }),
    });
  });

  it('sets each group only against the config before it, showing no changes where either is not on record, A, B not on record, C', async () => {
    const reader = await reading();
    for (const [runId, fingerprint, hour] of [
      ['run_1', FIRST_CONFIG, 1],
      ['run_2', UNKNOWN_CONFIG, 2],
      ['run_3', THIRD_CONFIG, 3],
    ] as const) {
      await reader.records.add(
        endedRecord(runId, {
          fingerprint,
          startedAt: at(hour),
          endedAt: at(hour),
        }),
      );
    }

    const insights = await reader.read();

    expect(
      insights.groups.map((group) => ({
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
    const reader = await reading();
    await reader.records.add(
      endedRecord('run_long', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(9),
      }),
    );
    await reader.records.add(
      endedRecord('run_x', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(2),
        endedAt: at(2),
      }),
    );
    await reader.records.add(
      endedRecord('run_y', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(2),
        endedAt: at(3),
      }),
    );

    const insights = await reader.read(1);

    expect(
      insights.groups.map((group) => ({
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
      (await reader.read(2)).groups.map((group) =>
        group.runs.map((each) => each.runId),
      ),
    ).toEqual([['run_y'], ['run_x']]);
  });

  it('looks at only as many of the latest runs as requested', async () => {
    const reader = await reading();
    for (const hour of [1, 2, 3]) {
      await reader.records.add(
        endedRecord(`run_${hour}`, { endedAt: at(hour) }),
      );
    }

    const insights = await reader.read(2);

    expect(insights.groups[0]?.runs.map((each) => each.runId)).toEqual([
      'run_3',
      'run_2',
    ]);
  });

  it('shows only the requested station’s runs', async () => {
    const reader = await reading();
    await reader.records.add(endedRecord('run_1', { stationId: 'station_2' }));

    expect((await reader.read()).groups).toEqual([]);
  });

  it('shows the latest pull request Spotlight opened proposing each group’s config at the station, and none where it opened none', async () => {
    const reader = await reading();
    const opened = (
      id: string,
      fingerprint: string,
      openedAt: Date,
      change: { stationId?: string; teamId?: TeamId } = {},
    ) =>
      reader.pullRequests.note({
        configPullRequestId: id,
        workspaceId: WORKSPACE,
        teamId: change.teamId ?? TEAM,
        stationId: change.stationId ?? 'station_1',
        fingerprint,
        url: PullRequestUrl.of(`https://github.com/acme/platform/pull/${id}`),
        openedAt,
      });
    await reader.records.add(
      endedRecord('run_1', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
      }),
    );
    await reader.records.add(
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

    const insights = await reader.read();

    expect(
      insights.groups.map((group) => [group.fingerprint, group.pullRequest]),
    ).toEqual([
      [SECOND_CONFIG, { url: 'https://github.com/acme/platform/pull/8' }],
      [FIRST_CONFIG, null],
    ]);
  });

  it('keeps runs that ran no config before any that did in a group without a config', async () => {
    const reader = await reading();
    await reader.records.add(
      endedRecord('run_1', { fingerprint: null, startedAt: at(1) }),
    );

    const insights = await reader.read();

    expect(insights.groups[0]?.firstRunId).toBe('run_1');
    expect(insights.groups[0]?.fingerprint).toBeNull();
    expect(insights.groups[0]?.config).toBeNull();
    expect(reader.requested).toEqual([[]]);
  });

  it('carries on the config of the station’s last config run before the oldest reader run, setting the oldest group against it', async () => {
    const reader = await reading();
    await reader.records.add(
      endedRecord('run_0', {
        fingerprint: FIRST_CONFIG,
        startedAt: at(1),
        endedAt: at(1),
      }),
    );
    await reader.records.add(
      endedRecord('run_cancelled', {
        fingerprint: FIRST_CONFIG,
        endedAt: at(2),
        ending: 'cancelled',
      }),
    );
    await reader.records.add(
      endedRecord('run_1', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(3),
        endedAt: at(3),
      }),
    );
    await reader.records.add(
      endedRecord('run_2', {
        fingerprint: SECOND_CONFIG,
        startedAt: at(4),
        endedAt: at(4),
      }),
    );
    const shapeOf = (insights: Awaited<ReturnType<typeof reader.read>>) =>
      insights.groups.map((group) => ({
        firstRunId: group.firstRunId,
        fingerprint: group.fingerprint,
        model: group.config?.model,
        changes: group.changes.map((each) => [each.was, each.now]),
        runs: group.runs.map((each) => each.runId),
      }));

    expect(shapeOf(await reader.read(3))).toEqual([
      {
        firstRunId: 'run_1',
        fingerprint: SECOND_CONFIG,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: ['run_2', 'run_1'],
      },
      {
        firstRunId: 'run_cancelled',
        fingerprint: FIRST_CONFIG,
        model: 'sonnet',
        changes: [],
        runs: ['run_cancelled'],
      },
    ]);
    expect(shapeOf(await reader.read(2))).toEqual([
      {
        firstRunId: 'run_1',
        fingerprint: SECOND_CONFIG,
        model: 'opus',
        changes: [['sonnet', 'opus']],
        runs: ['run_2', 'run_1'],
      },
    ]);
    expect(shapeOf(await reader.read(1))).toEqual([
      {
        firstRunId: 'run_2',
        fingerprint: SECOND_CONFIG,
        model: 'opus',
        changes: [],
        runs: ['run_2'],
      },
    ]);
    expect(reader.requested).toEqual([
      [FIRST_CONFIG, FIRST_CONFIG, SECOND_CONFIG],
      [FIRST_CONFIG, SECOND_CONFIG],
      [SECOND_CONFIG],
    ]);
  });

  it('finds no team for someone not on it', async () => {
    const reader = await reading(false);

    await expect(reader.read()).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(reader.read()).rejects.toBeInstanceOf(ApplicationError);
  });
});
