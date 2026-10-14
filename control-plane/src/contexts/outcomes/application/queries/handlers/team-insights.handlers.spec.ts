import { insightsReaderInMemory } from '@outcomes/application/ports/insights-reader.fake-spec';
import type { PeoplePort } from '@outcomes/application/ports/people.port';
import type { WorkPort } from '@outcomes/application/ports/work.port';
import { ListInsightsRunsHandler } from '@outcomes/application/queries/handlers/list-insights-runs.handler';
import { ReadInsightsOverviewHandler } from '@outcomes/application/queries/handlers/read-insights-overview.handler';
import { ReadInsightsPeopleHandler } from '@outcomes/application/queries/handlers/read-insights-people.handler';
import { ReadInsightsStationsHandler } from '@outcomes/application/queries/handlers/read-insights-stations.handler';
import { ReadInsightsToolsHandler } from '@outcomes/application/queries/handlers/read-insights-tools.handler';
import { ListInsightsRunsQuery } from '@outcomes/application/queries/list-insights-runs.query';
import { ReadInsightsOverviewQuery } from '@outcomes/application/queries/read-insights-overview.query';
import { ReadInsightsPeopleQuery } from '@outcomes/application/queries/read-insights-people.query';
import { ReadInsightsStationsQuery } from '@outcomes/application/queries/read-insights-stations.query';
import { ReadInsightsToolsQuery } from '@outcomes/application/queries/read-insights-tools.query';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { TeamHistories } from '@outcomes/application/services/team-histories.service';
import {
  ChatRecordsInMemory,
  chatOf,
  day,
  deliveredOf,
  TaskFailuresInMemory,
  TaskTouchesInMemory,
  touchesOf,
} from '@outcomes/domain/insights.fake-spec';
import {
  costedRecord,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import type { RunFilterAsked } from '@outcomes/domain/services/run-filter';
import { RunTools } from '@outcomes/domain/value-objects/run-tools.vo';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import {
  PersonPrincipal,
  type Principal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkspaceTokenId } from '@shared-kernel/domain/value-objects/workspace-token-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T15:00:00.000Z');

const READ_TOKEN = TokenPrincipal.of({
  tokenId: WorkspaceTokenId.of('token_1'),
  workspaceId: WORKSPACE,
  scopes: TokenScopes.named(['read']),
  issuedBy: UserId.of('user_ada'),
});

const STRANGER = PersonPrincipal.of(UserId.of('user_eve'));

const ANY: RunFilterAsked = {
  lineId: null,
  stationId: null,
  outcome: null,
  harness: null,
  model: null,
  repository: null,
  fingerprint: null,
  taskId: null,
  taskIds: null,
  personId: null,
  day: null,
  week: null,
  skillGiven: null,
  skillUsed: null,
  server: null,
  serverFailed: null,
  failedAfter: null,
  refusedTool: null,
  refusedServer: null,
  delivery: null,
  next: null,
  asked: null,
};

const insights = async () => {
  const records = new RunRecordsInMemory();
  const deliveries = new TaskDeliveriesInMemory();
  const touches = new TaskTouchesInMemory(records);
  const failures = new TaskFailuresInMemory();
  const chats = new ChatRecordsInMemory();
  const cleared: Principal[] = [];
  const people: PeoplePort = {
    clearedOnTeam: async (_teamId, principal) => {
      cleared.push(principal);
      return principal.kind === 'token' ||
        principal.userId.equals(UserId.of('user_ada'))
        ? { workspaceId: WorkspaceId.of('ws_1'), by: principal.userId }
        : null;
    },
    namesOf: async (ids) =>
      new Map(ids.map((each) => [each, `Name of ${each}`])),
  };
  const histories = new TeamHistories(
    new OutcomesAccess(people),
    { records, deliveries, touches, failures, chats },
    { now: () => NOW, sleep: async () => {} },
  );

  for (const [runId, taskId, hour] of [
    ['run_1', 'task_1', 9],
    ['run_2', 'task_2', 10],
    ['run_3', 'task_2', 11],
  ] as const) {
    await records.add(
      costedRecord(runId, { taskId, endedAt: day('2026-09-29', hour) }),
    );
  }
  await deliveries.add(
    deliveredOf('task_1', {
      openedAt: day('2026-09-29', 9),
      closedAt: day('2026-09-30'),
    }),
  );
  await touches.add(touchesOf('task_1', { openedBy: 'user_ada' }));
  await touches.add(touchesOf('task_2', { openedBy: 'user_bob' }));
  await chats.add(chatOf('chat_1', 'user_cy', day('2026-09-30')));

  const reader = insightsReaderInMemory({
    records,
    deliveries,
    touches,
    failures,
    chats,
  });

  return { histories, reader, people, cleared, records, touches, deliveries };
};

describe('the team’s insights', () => {
  it('answers a workspace token that may read the workspace', async () => {
    const { histories, people, cleared } = await insights();

    const overview = await new ReadInsightsOverviewHandler(
      histories,
      people,
    ).execute(new ReadInsightsOverviewQuery('team_1', READ_TOKEN, '7d'));

    expect(cleared).toEqual([READ_TOKEN]);
    expect(overview.period.name).toBe('7d');
    expect(overview.headline).toMatchObject({
      runs: 3,
      tasks: 2,
      mergedPullRequests: 1,
      spend: { amount: 1.5, currency: 'USD' },
    });
    expect(overview.changes.mergedPullRequests).toMatchObject({
      fromZero: true,
      direction: 'up',
      tone: 'good',
    });
    expect(overview.changes.spend).toBeNull();
    expect(overview.output).toHaveLength(7);
    expect(overview.people).toEqual([
      { personId: 'user_ada', name: 'Name of user_ada' },
      { personId: 'user_bob', name: 'Name of user_bob' },
      { personId: 'user_cy', name: 'Name of user_cy' },
    ]);
  });

  it('finds no team for someone not on it', async () => {
    const { histories, people } = await insights();

    await expect(
      new ReadInsightsOverviewHandler(histories, people).execute(
        new ReadInsightsOverviewQuery('team_1', STRANGER, '7d'),
      ),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('refuses a period it does not look back over', async () => {
    const { histories, people } = await insights();

    await expect(
      new ReadInsightsOverviewHandler(histories, people).execute(
        new ReadInsightsOverviewQuery('team_1', READ_TOKEN, '14d'),
      ),
    ).rejects.toMatchObject({ kind: 'invalid-input' });
  });

  it('tallies each station the way the Station page does', async () => {
    const { histories, reader } = await insights();

    const stations = await new ReadInsightsStationsHandler(
      histories,
      reader,
    ).execute(
      new ReadInsightsStationsQuery(
        'team_1',
        PersonPrincipal.of(UserId.of('user_ada')),
        '7d',
      ),
    );

    expect(stations.stations.map((each) => each.stationId)).toEqual([
      'station_1',
    ]);
    expect(stations.stations[0]?.tally).toMatchObject({
      runs: 3,
      merged: 1,
      medianMs: 60_000,
      p90Ms: 60_000,
    });
    expect(stations.team).toEqual(stations.stations[0]?.tally);
    expect(stations.teamChanges).toEqual(stations.stations[0]?.changes);
    expect(stations.teamChanges.runs).toMatchObject({
      fromZero: true,
      tone: 'flat',
    });
  });

  it('lists the runs a page at a time, with who opened each task', async () => {
    const { histories, people, records, touches, deliveries } =
      await insights();
    const listing = new ListInsightsRunsHandler(
      histories,
      records,
      touches,
      deliveries,
      people,
    );

    const first = await listing.execute(
      new ListInsightsRunsQuery('team_1', READ_TOKEN, '7d', ANY, 1, 2),
    );
    const second = await listing.execute(
      new ListInsightsRunsQuery('team_1', READ_TOKEN, '7d', ANY, 2, 2),
    );

    expect(first.total).toBe(3);
    expect(first.runs.map((each) => [each.runId, each.openedBy])).toEqual([
      ['run_3', 'user_bob'],
      ['run_2', 'user_bob'],
    ]);
    expect(first.people).toEqual([
      { personId: 'user_bob', name: 'Name of user_bob' },
    ]);
    expect(second.runs.map((each) => each.runId)).toEqual(['run_1']);
    expect(second.runs[0]?.delivery).toBe('merged');
  });

  it('calls someone new only if nothing they did on the team came before the period', async () => {
    const { histories, people } = await insights();

    const read = await new ReadInsightsPeopleHandler(
      histories,
      {
        onTeam: async () => new Map([['user_ada', day('2026-01-01')]]),
      },
      people,
    ).execute(new ReadInsightsPeopleQuery('team_1', READ_TOKEN, '7d'));

    expect(read.adoption.activeCount).toBe(3);
    expect(read.adoption.newAdopterCount).toBe(2);
    expect(
      read.adoption.people.map((each) => [each.personId, each.isNew]),
    ).toEqual([
      ['user_ada', false],
      ['user_bob', true],
      ['user_cy', true],
    ]);
  });

  it('reads which skills and servers the period’s runs used from what each run was digested with', async () => {
    const { histories, records } = await insights();
    const asked: string[] = [];
    const work: WorkPort = {
      endedRun: async () => null,
      configsInOrder: async () => [],
      teamRepositories: async () => [],
      teamSkillKeys: async (teamId) => {
        asked.push(teamId);
        return ['grafana', 'release-notes'];
      },
      alertsAt: async () => null,
    };
    await records.add(
      costedRecord('run_4', {
        taskId: 'task_3',
        endedAt: day('2026-09-30'),
        skills: ['grafana'],
        tools: RunTools.of({
          servers: [
            {
              server: 'linear',
              calls: 2,
              failed: 0,
              latency: LatencyHistogram.timing([100, 300]),
              lastCallFailed: false,
            },
          ],
          skillsRead: ['grafana'],
        }),
      }),
    );

    const tools = await new ReadInsightsToolsHandler(histories, work).execute(
      new ReadInsightsToolsQuery('team_1', READ_TOKEN, '7d'),
    );

    expect(asked).toEqual(['team_1']);
    expect(tools.runs).toBe(4);
    expect(tools.weeks).toEqual(['2026-09-21', '2026-09-28']);
    expect(tools.trendRule).toEqual({
      recentWeeks: 2,
      fewestRuns: 5,
      shiftPoints: 20,
    });
    expect(tools.skills.map((each) => [each.key, each.used])).toEqual([
      ['grafana', 1],
    ]);
    expect(tools.unused).toEqual(['release-notes']);
    expect(tools.servers).toEqual([
      expect.objectContaining({ server: 'linear', runs: 1, callsPerRun: 2 }),
    ]);
  });

  it('finds no tools for someone not on the team', async () => {
    const { histories } = await insights();
    const work = { teamSkillKeys: async () => [] } as unknown as WorkPort;

    await expect(
      new ReadInsightsToolsHandler(histories, work).execute(
        new ReadInsightsToolsQuery('team_1', STRANGER, '7d'),
      ),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
