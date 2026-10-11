import type { PullRequestActivity } from '@github/application/dto/pull-request-activity.dto';
import type { GitHubWebhooksPort } from '@github/application/ports/github-webhooks.port';
import { GitHubSource } from '@integrations/infrastructure/sources/github.source';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
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
  about: null,
  remark: null,
  byBot: false,
};

const OPENED: PullRequestActivity = {
  activity: 'opened',
  branch: 'fix-uploads',
  pullRequest: 'https://github.com/acme/api/pull/7',
  label: null,
  about: {
    title: 'Retry uploads',
    body: 'They give up too soon.',
    author: 'octocat',
    authorAssociation: 'CONTRIBUTOR',
    draft: false,
  },
  remark: null,
  byBot: false,
};

const sourceOver = (activity: readonly PullRequestActivity[]) => {
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

  return { source: new GitHubSource(github), github, order };
};

const readOne = async (activity: PullRequestActivity) =>
  (await sourceOver([activity]).source.read(DELIVERED))[0];

describe('GitHubSource', () => {
  it('reads a merged pull request by its branch and pull request', async () => {
    expect(await readOne(MERGED)).toEqual({
      happening: 'github.pull_request.merged',
      told: 'The pull request was merged.',
      spoken: false,
      state: 'raised',
      concerns: {
        branch: 'spotlight/task_1',
        marks: [
          {
            kind: PULL_REQUEST_MARK,
            value: 'https://github.com/acme/api/pull/7',
          },
        ],
      },
      said: null,
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

  it('carries what was said, and where', async () => {
    expect(
      (
        await readOne({
          ...MERGED,
          activity: 'commented',
          remark: {
            body: 'Extract this.',
            path: 'compose.yml',
            from: 10,
            to: 14,
            id: 'PRRC_1',
          },
        })
      ).said,
    ).toEqual({
      body: 'Extract this.',
      path: 'compose.yml',
      from: 10,
      to: 14,
      remark: 'PRRC_1',
    });
  });

  it('reads activity known only by its pull request or only by its branch', async () => {
    expect((await readOne({ ...MERGED, branch: null })).concerns).toMatchObject(
      { branch: null, marks: [{ kind: PULL_REQUEST_MARK }] },
    );
    expect((await readOne({ ...MERGED, pullRequest: null })).concerns).toEqual({
      branch: 'spotlight/task_1',
      marks: [],
    });
  });

  it('marks what a bot did as Spotlight’s own', async () => {
    expect(await readOne({ ...MERGED, byBot: true })).toMatchObject({
      ourOwn: true,
    });
  });

  it('refuses activity it should have understood and could not', async () => {
    await expect(
      sourceOver([{ ...MERGED, branch: null, pullRequest: null }]).source.read(
        DELIVERED,
      ),
    ).rejects.toThrow(UpstreamRefusedError);
  });

  it('asks for a review of a pull request opened, found by the review it wants', async () => {
    expect(await readOne(OPENED)).toEqual({
      happening: 'github.pull_request.opened',
      told: 'A pull request was opened for review.',
      spoken: false,
      state: 'raised',
      concerns: {
        branch: null,
        marks: [
          { kind: REVIEW_MARK, value: 'https://github.com/acme/api/pull/7' },
        ],
      },
      said: null,
      ourOwn: false,
      opens: {
        onto: 'review',
        at: null,
        title: 'Retry uploads',
        description:
          'Review https://github.com/acme/api/pull/7\n\nThey give up too soon.',
        assignEmail: null,
        marks: [
          { kind: REVIEW_MARK, value: 'https://github.com/acme/api/pull/7' },
        ],
        review: {
          asking: 'opened',
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

  it('asks for a review of a pull request labelled, with the label it was given', async () => {
    const asked = await readOne({
      ...OPENED,
      activity: 'labelled',
      label: 'spotlight',
    });

    expect(asked).toMatchObject({
      happening: 'github.pull_request.labelled',
      concerns: {
        marks: [
          { kind: REVIEW_MARK, value: 'https://github.com/acme/api/pull/7' },
        ],
      },
      opens: {
        onto: 'review',
        review: { asking: 'labelled', label: 'spotlight' },
      },
    });
  });

  it('hears nothing of a label GitHub did not name', async () => {
    expect(
      await sourceOver([
        { ...OPENED, activity: 'labelled', label: null },
      ]).source.read(DELIVERED),
    ).toEqual([]);
  });

  it('reads a comment naming somebody as a comment and as a mention', async () => {
    const read = await sourceOver([
      {
        ...OPENED,
        activity: 'commented',
        remark: {
          body: '@spotlight have a look',
          path: null,
          from: null,
          to: null,
          id: 'IC_1',
        },
      },
    ]).source.read(DELIVERED);

    expect(read.map((each) => each.happening)).toEqual([
      'github.pull_request.commented',
      'github.pull_request.commented',
      'github.pull_request.mentioned',
    ]);
    expect(read[2]).toMatchObject({
      spoken: true,
      said: { body: '@spotlight have a look' },
      opens: { review: { asking: 'mentioned' } },
    });
  });

  it('hears no mention in a comment naming nobody', async () => {
    const read = await sourceOver([
      {
        ...OPENED,
        activity: 'commented',
        remark: {
          body: 'Looks good',
          path: null,
          from: null,
          to: null,
          id: null,
        },
      },
    ]).source.read(DELIVERED);

    expect(read.map((each) => each.happening)).toEqual([
      'github.pull_request.commented',
      'github.pull_request.commented',
    ]);
  });

  it('tells the task reviewing a pull request what happened to it, apart from the task that opened it', async () => {
    const read = await sourceOver([MERGED]).source.read(DELIVERED);

    expect(read.map((each) => each.concerns)).toEqual([
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

  it('refuses a pull request opened that it cannot name', async () => {
    await expect(
      sourceOver([{ ...OPENED, pullRequest: null }]).source.read(DELIVERED),
    ).rejects.toThrow(UpstreamRefusedError);
  });

  it('says nothing where GitHub heard no activity', async () => {
    expect(await sourceOver([]).source.read(DELIVERED)).toEqual([]);
  });

  it('hands GitHub the delivery before reading what happened', async () => {
    const { source, github, order } = sourceOver([MERGED]);

    await source.read(DELIVERED);

    expect(github.receive).toHaveBeenCalledWith(DELIVERED);
    expect(order).toEqual(['receive', 'activity']);
  });

  it('leaves verifying, naming and routing the delivery to GitHub', async () => {
    const { source, github } = sourceOver([]);

    expect(await source.verifies(DELIVERED)).toBe(true);
    expect(source.delivery(DELIVERED)).toBe('d_1');
    expect(await source.routes(DELIVERED)).toEqual(WorkspaceId.of('ws_1'));
    expect(github.verifies).toHaveBeenCalledWith(DELIVERED);
    expect(github.idOf).toHaveBeenCalledWith(DELIVERED);
    expect(github.workspaceOf).toHaveBeenCalledWith(DELIVERED);
  });
});
