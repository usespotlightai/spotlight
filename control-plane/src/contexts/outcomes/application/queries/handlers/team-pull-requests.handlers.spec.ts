import type { PeoplePort } from '@outcomes/application/ports/people.port';
import { ListInsightsPullRequestsHandler } from '@outcomes/application/queries/handlers/list-insights-pull-requests.handler';
import { ReadInsightsPullRequestsHandler } from '@outcomes/application/queries/handlers/read-insights-pull-requests.handler';
import { ListInsightsPullRequestsQuery } from '@outcomes/application/queries/list-insights-pull-requests.query';
import { ReadInsightsPullRequestsQuery } from '@outcomes/application/queries/read-insights-pull-requests.query';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { TeamHistories } from '@outcomes/application/services/team-histories.service';
import { TeamPullRequests } from '@outcomes/application/services/team-pull-requests.service';
import { PullRequestRecord } from '@outcomes/domain/aggregates/pull-request-record.aggregate';
import { TaskChangeShape } from '@outcomes/domain/aggregates/task-change-shape.aggregate';
import {
  ChatRecordsInMemory,
  TaskFailuresInMemory,
  TaskTouchesInMemory,
} from '@outcomes/domain/insights.fake-spec';
import {
  costedRecord,
  RunRecordsInMemory,
  TaskDeliveriesInMemory,
  TEAM,
  WORKSPACE,
} from '@outcomes/domain/outcomes.fake-spec';
import {
  PullRequestRecordsInMemory,
  seenOf,
  TaskChangeShapesInMemory,
} from '@outcomes/domain/pull-requests.fake-spec';
import type { PullRequestFilterAsked } from '@outcomes/domain/services/pull-request-filter';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import {
  PersonPrincipal,
  TokenPrincipal,
} from '@shared-kernel/domain/value-objects/principal.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
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

const ANY: PullRequestFilterAsked = {
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
  const people: PeoplePort = {
    clearedOnTeam: async (_teamId, principal) =>
      principal.kind === 'token' ||
      principal.userId.equals(UserId.of('user_ada'))
        ? { workspaceId: WORKSPACE, by: principal.userId }
        : null,
    namesOf: async () => new Map(),
  };
  const histories = new TeamHistories(
    new OutcomesAccess(people),
    {
      records,
      deliveries: new TaskDeliveriesInMemory(),
      touches: new TaskTouchesInMemory(records),
      failures: new TaskFailuresInMemory(),
      chats: new ChatRecordsInMemory(),
    },
    { now: () => NOW, sleep: async () => {} },
  );
  const service = new TeamPullRequests(
    histories,
    {
      endedRun: async () => null,
      configsInOrder: async () => [],
      teamRepositories: async () => ['acme/api'],
      teamSkillKeys: async () => [],
      alertsAt: async () => null,
    },
    { records: pullRequests, runs: records, shapes },
  );

  await pullRequests.add(
    PullRequestRecord.noted(WORKSPACE, pull('acme/api', 1))
      .seenAs(
        seenOf({ number: 1, title: 'Uploads', ...mergedOn('2026-09-29') }),
      )
      .ownedBy({ taskId: TaskId.of('task_1'), teamId: TEAM }),
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
      .ownedBy({ taskId: TaskId.of('task_4'), teamId: TeamId.of('team_2') }),
  );
  await records.add(costedRecord('run_1', { taskId: 'task_1', amount: 1.25 }));
  await records.add(costedRecord('run_2', { taskId: 'task_1', amount: 0.75 }));
  await shapes.add(
    TaskChangeShape.shaped({
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

  return { service, pullRequests };
};

describe('the team’s pull requests', () => {
  it('answers how much of what merged in the team’s repositories Spotlight made', async () => {
    const { service } = await team();

    const insights = await new ReadInsightsPullRequestsHandler(service).execute(
      new ReadInsightsPullRequestsQuery(TEAM.value, READ_TOKEN, '7d'),
    );

    expect(insights.repositories).toEqual(['acme/api']);
    expect(insights.total).toBe(2);
    expect(insights.penetration).toMatchObject({
      merged: 2,
      made: 1,
      touched: 0,
      share: 0.5,
    });
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

    expect(insights.penetration).toMatchObject({ merged: 3, bots: 1 });
    expect(insights.comparison.people.merged).toBe(1);
    expect(bots.pullRequests.map((each) => each.number)).toEqual([5]);
  });

  it('lists only what merged where Spotlight merged when asked for the compared repositories', async () => {
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
        .ownedBy({ taskId: TaskId.of('task_6'), teamId: TEAM }),
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

  it('refuses a filter it does not know, and a person off the team', async () => {
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
    ).rejects.toMatchObject({ kind: 'invalid-input' });
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
    ).rejects.toBeInstanceOf(UseCaseFault);
  });
});
