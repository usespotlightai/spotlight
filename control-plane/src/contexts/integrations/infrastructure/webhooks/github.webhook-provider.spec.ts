import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import { GitHubWebhookProvider } from '@integrations/infrastructure/webhooks/github.webhook-provider';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import {
  PULL_REQUEST_MARK,
  REVIEW_MARK,
} from '@work/application/contracts/happenings.contract';
import { describe, expect, it, vi } from 'vitest';

const DELIVERED = { headers: {}, body: {}, raw: null };

const MERGED: PullRequestActivity = {
  activity: 'merged',
  branch: 'spotlight/task_1',
  pullRequest: 'https://github.com/acme/api/pull/7',
  label: null,
  details: null,
  reviewComment: null,
  byBot: false,
};

const OPENED: PullRequestActivity = {
  activity: 'opened',
  branch: 'fix-uploads',
  pullRequest: 'https://github.com/acme/api/pull/7',
  label: null,
  details: {
    title: 'Retry uploads',
    body: 'They give up too soon.',
    author: 'octocat',
    authorAssociation: 'CONTRIBUTOR',
    draft: false,
  },
  reviewComment: null,
  byBot: false,
};

const providerOver = (activity: readonly PullRequestActivity[]) => {
  const order: string[] = [];
  const github = {
    verifies: vi.fn(() => true),
    idOf: vi.fn(() => 'd_1'),
    workspaceOf: vi.fn(async () => WorkspaceId.of('ws_1')),
    receive: vi.fn(async () => {
      order.push('receive');
    }),
    activityIn: vi.fn(() => {
      order.push('activity');
      return activity;
    }),
  } satisfies GitHubWebhooksPort;

  return { provider: new GitHubWebhookProvider(github), github, order };
};

const readOne = async (activity: PullRequestActivity) =>
  (await providerOver([activity]).provider.read(DELIVERED))[0];

describe('GitHubWebhookProvider', () => {
  it('reads a merged pull request by its branch and pull request', async () => {
    expect(await readOne(MERGED)).toEqual({
      happening: 'github.pull_request.merged',
      summary: 'The pull request was merged.',
      answers: false,
      state: 'raised',
      correlationKeys: {
        branch: 'spotlight/task_1',
        marks: [
          {
            kind: PULL_REQUEST_MARK,
            value: 'https://github.com/acme/api/pull/7',
          },
        ],
      },
      message: null,
      ourOwn: false,
      opens: null,
    });
  });

  it('names each kind of activity by its word', async () => {
    const words = await Promise.all(
      (
        [
          'merged',
          'closed-unmerged',
          'commented',
          'changes-requested',
          'checks-failed',
        ] as const
      ).map(
        async (activity) => (await readOne({ ...MERGED, activity })).happening,
      ),
    );

    expect(words).toEqual([
      'github.pull_request.merged',
      'github.pull_request.closed-unmerged',
      'github.pull_request.commented',
      'github.pull_request.changes-requested',
      'github.checks.failed',
    ]);
  });

  it('carries the review comment, and where it is', async () => {
    expect(
      (
        await readOne({
          ...MERGED,
          activity: 'commented',
          reviewComment: {
            body: 'Extract this.',
            path: 'compose.yml',
            from: 10,
            to: 14,
            id: 'PRRC_1',
          },
        })
      ).message,
    ).toEqual({
      body: 'Extract this.',
      path: 'compose.yml',
      from: 10,
      to: 14,
      reviewComment: 'PRRC_1',
    });
  });

  it('reads activity known only by its pull request or only by its branch', async () => {
    expect(
      (await readOne({ ...MERGED, branch: null })).correlationKeys,
    ).toMatchObject({ branch: null, marks: [{ kind: PULL_REQUEST_MARK }] });
    expect(
      (await readOne({ ...MERGED, pullRequest: null })).correlationKeys,
    ).toEqual({
      branch: 'spotlight/task_1',
      marks: [],
    });
  });

  it('marks what a bot did as Spotlight’s own', async () => {
    expect(await readOne({ ...MERGED, byBot: true })).toMatchObject({
      ourOwn: true,
    });
  });

  it('fails on activity it should have understood and could not', async () => {
    await expect(
      providerOver([
        { ...MERGED, branch: null, pullRequest: null },
      ]).provider.read(DELIVERED),
    ).rejects.toThrow(UpstreamError);
  });

  it('requests a review of a pull request opened, found by the review it wants', async () => {
    expect(await readOne(OPENED)).toEqual({
      happening: 'github.pull_request.opened',
      summary: 'A pull request was opened for review.',
      answers: false,
      state: 'raised',
      correlationKeys: {
        branch: null,
        marks: [
          { kind: REVIEW_MARK, value: 'https://github.com/acme/api/pull/7' },
        ],
      },
      message: null,
      ourOwn: false,
      opens: {
        lineRole: 'review',
        station: null,
        title: 'Retry uploads',
        description:
          'Review https://github.com/acme/api/pull/7\n\nThey give up too soon.',
        assignEmail: null,
        marks: [
          { kind: REVIEW_MARK, value: 'https://github.com/acme/api/pull/7' },
        ],
        review: {
          trigger: 'opened',
          label: null,
          pullRequest: 'https://github.com/acme/api/pull/7',
          author: 'octocat',
          outside: true,
          draft: false,
          branch: 'fix-uploads',
        },
      },
    });
  });

  it('requests a review of a pull request labelled, with its label', async () => {
    const reviewRequest = await readOne({
      ...OPENED,
      activity: 'labelled',
      label: 'spotlight',
    });

    expect(reviewRequest).toMatchObject({
      happening: 'github.pull_request.labelled',
      correlationKeys: {
        marks: [
          { kind: REVIEW_MARK, value: 'https://github.com/acme/api/pull/7' },
        ],
      },
      opens: {
        lineRole: 'review',
        review: { trigger: 'labelled', label: 'spotlight' },
      },
    });
  });

  it('reads nothing from a label GitHub did not name', async () => {
    expect(
      await providerOver([
        { ...OPENED, activity: 'labelled', label: null },
      ]).provider.read(DELIVERED),
    ).toEqual([]);
  });

  it('reads a comment naming somebody as a comment and as a mention', async () => {
    const read = await providerOver([
      {
        ...OPENED,
        activity: 'commented',
        reviewComment: {
          body: '@spotlight have a look',
          path: null,
          from: null,
          to: null,
          id: 'IC_1',
        },
      },
    ]).provider.read(DELIVERED);

    expect(read.map((each) => each.happening)).toEqual([
      'github.pull_request.commented',
      'github.pull_request.commented',
      'github.pull_request.mentioned',
    ]);
    expect(read[2]).toMatchObject({
      answers: true,
      message: { body: '@spotlight have a look' },
      opens: { review: { trigger: 'mentioned' } },
    });
  });

  it('finds no mention in a comment naming nobody', async () => {
    const read = await providerOver([
      {
        ...OPENED,
        activity: 'commented',
        reviewComment: {
          body: 'Looks good',
          path: null,
          from: null,
          to: null,
          id: null,
        },
      },
    ]).provider.read(DELIVERED);

    expect(read.map((each) => each.happening)).toEqual([
      'github.pull_request.commented',
      'github.pull_request.commented',
    ]);
  });

  it('tells the task reviewing a pull request what happened to it, apart from the task that opened it', async () => {
    const read = await providerOver([MERGED]).provider.read(DELIVERED);

    expect(read.map((each) => each.correlationKeys)).toEqual([
      {
        branch: 'spotlight/task_1',
        marks: [
          {
            kind: PULL_REQUEST_MARK,
            value: 'https://github.com/acme/api/pull/7',
          },
        ],
      },
      {
        branch: null,
        marks: [
          { kind: REVIEW_MARK, value: 'https://github.com/acme/api/pull/7' },
        ],
      },
    ]);
    expect(read[1]?.happening).toBe('github.pull_request.merged');
  });

  it('rejects a pull request opened that it cannot name', async () => {
    await expect(
      providerOver([{ ...OPENED, pullRequest: null }]).provider.read(DELIVERED),
    ).rejects.toThrow(UpstreamError);
  });

  it('says nothing where GitHub reported no activity', async () => {
    expect(await providerOver([]).provider.read(DELIVERED)).toEqual([]);
  });

  it('hands GitHub the delivery before reading what happened', async () => {
    const { provider, github, order } = providerOver([MERGED]);

    await provider.read(DELIVERED);

    expect(github.receive).toHaveBeenCalledWith(DELIVERED);
    expect(order).toEqual(['receive', 'activity']);
  });

  it('leaves verifying, naming and routing the delivery to GitHub', async () => {
    const { provider, github } = providerOver([]);

    expect(await provider.verifies(DELIVERED)).toBe(true);
    expect(provider.delivery(DELIVERED)).toBe('d_1');
    expect(await provider.routes(DELIVERED)).toEqual(WorkspaceId.of('ws_1'));
    expect(github.verifies).toHaveBeenCalledWith(DELIVERED);
    expect(github.idOf).toHaveBeenCalledWith(DELIVERED);
    expect(github.workspaceOf).toHaveBeenCalledWith(DELIVERED);
  });
});
