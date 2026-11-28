import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  type Happened,
  REVIEW_MARK,
} from '@work/application/contracts/happenings.contract';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { processedEventsInMemory } from '@work/application/ports/processed-events.fake-spec';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import type { ChannelChats } from '@work/application/services/channel-chats.service';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
import {
  repositoryOf,
  reviewLineOf,
  reviewsOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { DrizzlePullRequestReviewLocks } from '@work/infrastructure/persistence/drizzle/pull-request-review-locks';
import { DrizzleTaskRepository } from '@work/infrastructure/persistence/drizzle/repositories/task.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';
import * as schema from './support/schema';
import { insertStations } from './support/stations';
import { createTeam } from './support/team';

const NOW = new Date('2026-11-20T09:00:00.000Z');
const PULL = 'https://github.com/acme/api/pull/7';
const CLOSED_PULL = 'https://github.com/acme/api/pull/8';

let database: TestDatabase;
let context: DrizzleContext;
let tasks: DrizzleTaskRepository;
let line: LineMap;
let owner: UserId;
let workspaceId: WorkspaceId;

const clock: ClockPort = { now: () => NOW, sleep: async () => {} };

const dispatch: TaskDispatching = {
  runIdFor: async () => RunId.of(randomUUID()),
};

const placements: TaskPlacementsPort = {
  placementsAt: async () => [],
};

const unused = async (): Promise<never> => {
  throw new Error('a review request without files touches no attachment');
};

const files: AttachmentStorePort = {
  grant: unused,
  received: unused,
  stored: unused,
  taken: unused,
  save: unused,
  copy: unused,
  link: unused,
  linkPending: unused,
  open: unused,
};

const lines: LineMapsPort = {
  find: async () => line,
  findByStation: async () => line,
  ofTeam: async () => [line],
  ofWorkspace: async () => [line],
  candidate: unused,
};

const silent = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

const reactions = (): ReactToHappenings =>
  new ReactToHappenings(
    tasks,
    placements,
    lines,
    dispatch,
    context,
    clock,
    { generate: () => randomUUID() },
    { byEmail: async () => null },
    files,
    processedEventsInMemory(),
    silent,
    partial<ChannelChats>({
      reached: async () => null,
      answer: async () => {},
    }),
    { of: async () => [] },
    { membersOf: async () => TeamMembers.of([owner]) },
    new DrizzlePullRequestReviewLocks(context),
  );

const requested = (
  trigger: 'opened' | 'labelled',
  pullRequest = PULL,
): Happened => {
  const marks = [{ kind: REVIEW_MARK, value: pullRequest }];

  return {
    happening: `github.pull_request.${trigger}`,
    summary: 'A pull request wants a review.',
    answers: false,
    state: 'raised',
    correlationKeys: { branch: null, marks },
    message: null,
    ourOwn: false,
    opens: {
      lineRole: 'review',
      station: null,
      title: 'Retry uploads',
      description: `Review ${pullRequest}`,
      assignEmail: null,
      marks,
      review: {
        trigger,
        label: trigger === 'labelled' ? 'spotlight' : null,
        pullRequest,
        author: 'octocat',
        outside: true,
        draft: false,
        branch: 'fix-uploads',
      },
    },
  };
};

const closedUnmerged = (pullRequest: string): Happened => ({
  happening: 'github.pull_request.closed-unmerged',
  summary: 'The pull request was closed without being merged.',
  answers: false,
  state: 'raised',
  correlationKeys: {
    branch: null,
    marks: [{ kind: REVIEW_MARK, value: pullRequest }],
  },
  message: null,
  ourOwn: false,
  opens: null,
  closedPullRequest: pullRequest,
  closedUnmerged: true,
});

beforeAll(async () => {
  database = await openDatabase('review_request_races');
  context = new DrizzleContext(database.db);
  tasks = new DrizzleTaskRepository(context, { dispatch: async () => {} });

  const team = await createTeam(
    database.db,
    tasks,
    `review-races-${randomUUID().slice(0, 8)}`,
  );
  owner = team.owner;
  workspaceId = team.workspaceId;
  line = reviewLineOf({
    workspaceId: team.workspaceId,
    teamId: team.teamId,
    harness: HarnessId.of('dev'),
    newId: () => randomUUID(),
    repositories: [repositoryOf(Repository.of('acme/api'))],
    reviews: reviewsOf({ start: 'opened' }),
  });

  await database.db.insert(schema.line).values({
    id: line.id.value,
    workspaceId: team.workspaceId.value,
    teamId: team.teamId.value,
    key: line.key.value,
    name: line.name.value,
  });
  await insertStations(
    database.db,
    line.stations.map((each) => ({
      id: each.id.value,
      workspaceId: team.workspaceId.value,
      lineId: line.id.value,
      key: each.key.value,
      name: each.name.value,
      position: each.position,
      kind: each.kind,
    })),
  );
}, 60_000);

afterAll(async () => {
  await database.close();
});

describe('two review requests for one pull request at once', () => {
  it('open one review between them', async () => {
    await Promise.all([
      reactions().react(workspaceId, null, [requested('opened')], 'one'),
      reactions().react(workspaceId, null, [requested('labelled')], 'two'),
    ]);

    const reviews = await context.inTransaction(() =>
      tasks.reviewsOf(workspaceId, PullRequestUrl.of(PULL)),
    );

    expect(reviews).toHaveLength(1);
  });
});

describe('a close of a pull request while a review request of it holds the pull request', () => {
  it('ends the review only once the request lets go of the pull request', async () => {
    const pullRequest = PullRequestUrl.of(CLOSED_PULL);
    await reactions().react(
      workspaceId,
      null,
      [requested('opened', CLOSED_PULL)],
      'open',
    );
    let letGo = () => {};
    const requesting = new Promise<void>((resolve) => {
      letGo = resolve;
    });
    let locked = () => {};
    const holding = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const request = context.inTransaction(async () => {
      await new DrizzlePullRequestReviewLocks(context).lock(
        workspaceId,
        pullRequest,
      );
      locked();
      await requesting;
    });
    await holding;

    let closed = false;
    const closing = reactions()
      .react(workspaceId, null, [closedUnmerged(CLOSED_PULL)], 'close')
      .then(() => {
        closed = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(closed).toBe(false);

    letGo();
    await request;
    await closing;

    const reviews = await context.inTransaction(() =>
      tasks.reviewsOf(workspaceId, pullRequest),
    );
    expect(reviews).toHaveLength(1);
    expect(reviews.some((each) => each.reviewsOpenOn(line, pullRequest))).toBe(
      false,
    );
  });
});
