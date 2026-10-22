import { insightsReaderInMemory } from '@insights/application/ports/insights-reader.fake-spec';
import type { PeoplePort } from '@insights/application/ports/people.port';
import { ListInsightsPullRequestsHandler } from '@insights/application/queries/handlers/list-insights-pull-requests.handler';
import { ReadInsightsPullRequestsHandler } from '@insights/application/queries/handlers/read-insights-pull-requests.handler';
import { ReadInsightsShippingHandler } from '@insights/application/queries/handlers/read-insights-shipping.handler';
import { ListInsightsPullRequestsQuery } from '@insights/application/queries/list-insights-pull-requests.query';
import { ReadInsightsPullRequestsQuery } from '@insights/application/queries/read-insights-pull-requests.query';
import { ReadInsightsShippingQuery } from '@insights/application/queries/read-insights-shipping.query';
import { InsightsAccess } from '@insights/application/services/insights-access.service';
import { TeamPullRequests } from '@insights/application/services/team-pull-requests.service';
import { TeamScopes } from '@insights/application/services/team-scopes.service';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import { TaskChangeShape } from '@insights/domain/aggregates/task-change-shape.aggregate';
import {
  ChatRecordsInMemory,
  humanActionsOf,
  TaskFailuresInMemory,
  TaskHumanActionsInMemory,
} from '@insights/domain/insights.fake-spec';
import {
  PullRequestRecordsInMemory,
  seenOf,
  TaskChangeShapesInMemory,
} from '@insights/domain/pull-requests.fake-spec';
import {
  costedRecord,
  RunRecordsInMemory,
  TaskPullRequestsInMemory,
  TEAM,
  WORKSPACE,
} from '@insights/domain/runs.fake-spec';
import type { PullRequestFilterQuery } from '@insights/domain/services/pull-request-filter';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { TokenScopes } from '@shared-kernel/domain/value-objects/token-scopes.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
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

const ANY: PullRequestFilterQuery = {
  repository: null,
  author: null,
  type: null,
  state: null,
  week: null,
  reverted: null,
  rounds: null,
  compared: null,
};

const pull = (repository: string, number: number) =>
  PullRequestUrl.of(`https://github.com/${repository}/pull/${number}`);

const mergedOn = (date: string) => ({
  state: 'merged' as const,
  openedAt: new Date(`${date}T08:00:00.000Z`),
  closedAt: new Date(`${date}T12:00:00.000Z`),
});

const team = async () => {
  const records = new RunRecordsInMemory();
  const pullRequests = new PullRequestRecordsInMemory();
  const shapes = new TaskChangeShapesInMemory();
  const humanActions = new TaskHumanActionsInMemory(records);
  const people: PeoplePort = {
    membershipOnTeam: async (_teamId, principal) =>
      principal.kind === 'token' ||
      principal.userId.equals(UserId.of('user_ada'))
        ? { workspaceId: WORKSPACE, by: principal.userId }
        : null,
    namesOf: async () => new Map(),
  };
  const historyRepositories = {
    records,
    taskPullRequests: new TaskPullRequestsInMemory(),
    taskHumanActions: humanActions,
    failures: new TaskFailuresInMemory(),
    chats: new ChatRecordsInMemory(),
  };
  const scopes = new TeamScopes(new InsightsAccess(people), {
    now: () => NOW,
    sleep: async () => {},
  });
  const reader = insightsReaderInMemory(historyRepositories, undefined, {
    records: pullRequests,
    shapes,
  });
  const service = new TeamPullRequests(
    scopes,
    {
      unfinishedRuns: async () => [],
      traced: async () => ({ tasks: [], stations: [], outputs: new Map() }),
      endedRun: async () => null,
      configsInOrder: async () => [],
      teamRepositories: async () => ['acme/api'],
      teamSkillKeys: async () => [],
      alertsAt: async () => null,
    },
    reader,
  );

  await pullRequests.add(
    PullRequestRecord.noted(WORKSPACE, pull('acme/api', 1))
      .seenAs(
        seenOf({ number: 1, title: 'Uploads', ...mergedOn('2026-09-29') }),
      )
      .assignOwner({ taskId: TaskId.of('task_1'), teamId: TEAM }),
  );
  await pullRequests.add(
    PullRequestRecord.noted(WORKSPACE, pull('acme/api', 2)).seenAs(
      seenOf({ number: 2, title: 'Fix login', ...mergedOn('2026-09-30') }),
    ),
  );
  await pullRequests.add(
    PullRequestRecord.noted(WORKSPACE, pull('acme/elsewhere', 3)).seenAs(
      seenOf({
        number: 3,
        repository: 'acme/elsewhere',
        ...mergedOn('2026-09-30'),
      }),
    ),
  );
  await pullRequests.add(
    PullRequestRecord.noted(WORKSPACE, pull('acme/other', 4))
      .seenAs(
        seenOf({
          number: 4,
          repository: 'acme/other',
          ...mergedOn('2026-09-30'),
        }),
      )
      .assignOwner({
        taskId: TaskId.of('task_4'),
        teamId: TeamId.of('team_2'),
      }),
  );
  await records.add(costedRecord('run_1', { taskId: 'task_1', amount: 1.25 }));
  await records.add(costedRecord('run_2', { taskId: 'task_1', amount: 0.75 }));
  await records.add(
    RunRecord.empty(
      RunId.of('run_still_working'),
      WORKSPACE,
      TaskId.of('task_1'),
    ).recordMemories('briefed', ['mem_1']),
  );
  await shapes.add(
    TaskChangeShape.create({
      taskId: TaskId.of('task_1'),
      workspaceId: WORKSPACE,
      teamId: TEAM,
      shape: {
        changeTitles: ['Refactor the upload queue'],
        changeIntents: [''],
        at: NOW,
      },
    }),
  );

  return { service, reader, pullRequests, humanActions };
};

describe('the team’s pull requests', () => {
  it('answers how much of what merged in the team’s repositories Spotlight made', async () => {
    const { service } = await team();

    const insights = await new ReadInsightsPullRequestsHandler(service).execute(
      new ReadInsightsPullRequestsQuery(TEAM.value, READ_TOKEN, '7d'),
    );

    expect(insights.repositories).toEqual(['acme/api']);
    expect(insights.total).toBe(2);
    expect(insights.spotlightShare).toMatchObject({
      merged: 2,
      authored: 1,
      reviewed: 0,
      rate: 0.5,
    });
    expect(
      insights.spotlightShare.weeks.reduce((sum, each) => sum + each.people, 0),
    ).toBe(1);
    expect(insights.comparison.spotlight.toMerge).toEqual({
      p50Ms: 4 * 60 * 60 * 1000,
      p90Ms: 4 * 60 * 60 * 1000,
      count: 1,
    });
    expect(insights.types.find((each) => each.type === 'refactor')).toEqual({
      type: 'refactor',
      spotlight: 1,
      people: 0,
      spend: { amount: 2, currency: 'USD' },
      unpriced: 0,
      mixedCurrencies: false,
    });
  });

  it('lists every pull request behind a number, with the task that made it and what its runs cost', async () => {
    const { service } = await team();

    const listed = await new ListInsightsPullRequestsHandler(service).execute(
      new ListInsightsPullRequestsQuery(
        TEAM.value,
        READ_TOKEN,
        '7d',
        { ...ANY, author: 'spotlight', state: 'merged' },
        null,
        null,
      ),
    );

    expect(listed.total).toBe(1);
    expect(listed.pullRequests).toEqual([
      expect.objectContaining({
        pullRequest: 'https://github.com/acme/api/pull/1',
        by: 'spotlight',
        taskId: 'task_1',
        type: 'refactor',
        toMergeMs: 4 * 60 * 60 * 1000,
        spend: { amount: 2, currency: 'USD' },
      }),
    ]);
  });

  it('tells bots’ pull requests from people’s, counting them only in the whole', async () => {
    const { service, pullRequests } = await team();
    await pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, pull('acme/api', 5)).seenAs(
        seenOf({
          number: 5,
          author: 'dependabot[bot]',
          authorIsBot: true,
          ...mergedOn('2026-09-30'),
        }),
      ),
    );

    const insights = await new ReadInsightsPullRequestsHandler(service).execute(
      new ReadInsightsPullRequestsQuery(TEAM.value, READ_TOKEN, '7d'),
    );
    const bots = await new ListInsightsPullRequestsHandler(service).execute(
      new ListInsightsPullRequestsQuery(
        TEAM.value,
        READ_TOKEN,
        '7d',
        { ...ANY, author: 'bots' },
        null,
        null,
      ),
    );

    expect(insights.spotlightShare).toMatchObject({ merged: 3, bots: 1 });
    expect(insights.comparison.people.merged).toBe(1);
    expect(bots.pullRequests.map((each) => each.number)).toEqual([5]);
  });

  it('lists only what merged where Spotlight merged when the query names the compared repositories', async () => {
    const { service, pullRequests } = await team();
    await pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, pull('acme/web', 6))
        .seenAs(
          seenOf({
            number: 6,
            repository: 'acme/web',
            openedAt: new Date('2026-09-30T08:00:00.000Z'),
          }),
        )
        .assignOwner({ taskId: TaskId.of('task_6'), teamId: TEAM }),
    );
    const listed = (compared: string | null) =>
      new ListInsightsPullRequestsHandler(service).execute(
        new ListInsightsPullRequestsQuery(
          TEAM.value,
          READ_TOKEN,
          '7d',
          { ...ANY, compared },
          null,
          null,
        ),
      );

    expect(
      (await listed(null)).pullRequests.map((each) => each.number).sort(),
    ).toEqual([1, 2, 6]);
    expect(
      (await listed('true')).pullRequests.map((each) => each.number).sort(),
    ).toEqual([1, 2]);
  });

  it('pages through the list', async () => {
    const { service } = await team();

    const second = await new ListInsightsPullRequestsHandler(service).execute(
      new ListInsightsPullRequestsQuery(
        TEAM.value,
        READ_TOKEN,
        '7d',
        ANY,
        2,
        1,
      ),
    );

    expect(second).toMatchObject({ total: 2, page: 2, size: 1 });
    expect(second.pullRequests.map((each) => each.number)).toEqual([1]);
  });

  it('rejects a filter it does not know, and a person off the team', async () => {
    const { service } = await team();
    const handler = new ListInsightsPullRequestsHandler(service);

    await expect(
      handler.execute(
        new ListInsightsPullRequestsQuery(
          TEAM.value,
          READ_TOKEN,
          '7d',
          { ...ANY, author: 'robots' },
          null,
          null,
        ),
      ),
    ).rejects.toMatchObject({ kind: 'invalid' });
    await expect(
      handler.execute(
        new ListInsightsPullRequestsQuery(
          TEAM.value,
          STRANGER,
          '7d',
          ANY,
          null,
          null,
        ),
      ),
    ).rejects.toBeInstanceOf(ApplicationError);
  });
});

describe('what the agents ship', () => {
  it('looks back into the previous period for the rolling days and the comparison, keeping the period’s numbers to the period', async () => {
    const { service, pullRequests, humanActions } = await team();
    await humanActions.add(
      humanActionsOf('task_1', {
        openedAt: new Date('2026-09-28T09:00:00.000Z'),
      }),
    );
    await pullRequests.add(
      PullRequestRecord.noted(WORKSPACE, pull('acme/api', 7))
        .seenAs(seenOf({ number: 7, ...mergedOn('2026-09-20') }))
        .assignOwner({ taskId: TaskId.of('task_7'), teamId: TEAM }),
    );

    const shipping = await new ReadInsightsShippingHandler(service).execute(
      new ReadInsightsShippingQuery(TEAM.value, READ_TOKEN, '7d'),
    );
    const [first] = shipping.mergeDays;

    expect(shipping.toMerge.spotlight).toMatchObject({
      p50Ms: 4 * 60 * 60 * 1000,
      count: 1,
    });
    expect(shipping.toMerge.people.count).toBe(1);
    expect(shipping.toMergeChanges.spotlight.p50).toMatchObject({
      direction: 'same',
      tone: 'flat',
    });
    expect(first?.daily.spotlight.count).toBe(0);
    expect(first?.rolling.spotlight.count).toBe(1);
    expect(shipping.pipeline.merged).toBe(1);
    expect(shipping.pipeline.layouts.stages.map((each) => each.kind)).toEqual([
      'coding',
      'awaitingReview',
      'inReview',
      'awaitingMerge',
    ]);
    expect(shipping.pipeline.layouts.stages[0]).toMatchObject({
      lineId: null,
      stationId: null,
      times: {
        all: {
          bottleneckRatio: { p50: expect.any(Number) },
          longestPart: null,
        },
      },
    });
    expect(shipping.slowestFirst.p50).toEqual(['refactor', 'fix']);
    expect(shipping.depthTotals.map((each) => each.rounds)).toEqual([
      '0',
      '1',
      '2',
      '3+',
    ]);
  });

  it('denies a person off the team', async () => {
    const { service } = await team();

    await expect(
      new ReadInsightsShippingHandler(service).execute(
        new ReadInsightsShippingQuery(TEAM.value, STRANGER, '7d'),
      ),
    ).rejects.toBeInstanceOf(ApplicationError);
  });
});
