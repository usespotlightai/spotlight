import { UpstreamRefusedError } from '@domain/exceptions/upstream-refused.error';
import { Happening } from '@domain/value-objects/happening.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { PullRequestUrl } from '@domain/value-objects/pull-request-url.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { GitHubSource } from '@infrastructure/github/github.source';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const signs = { signs: () => true };

const workspaces = {
  withConnection: vi.fn(async () => WorkspaceId.of('ws_1')),
  connectionTo: vi.fn(async () => null),
};

const events = new GitHubSource(signs, workspaces);

const delivered = (
  event: string | undefined,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) => ({
  headers: { ...(event ? { 'x-github-event': event } : {}), ...headers },
  body,
  raw: null,
});

/** Every App delivery names its installation, so every fixture does too. */
const reading = {
  read: async (event: string | undefined, payload: Record<string, unknown>) =>
    (
      await events.read(
        delivered(event, { installation: { id: 42 }, ...payload }),
      )
    )[0] ?? null,
};

const pull = (over: Record<string, unknown> = {}) => ({
  merged: true,
  html_url: 'https://github.com/acme/api/pull/7',
  head: { ref: 'spotlight/task_1' },
  ...over,
});

describe('GitHubSource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads a merged pull request', async () => {
    expect(
      await reading.read('pull_request', {
        action: 'closed',
        pull_request: pull(),
      }),
    ).toMatchObject({
      happening: Happening.of('github.pull_request.merged'),
      concerns: {
        taskId: TaskId.of('task_1'),
        marks: [
          Mark.pullRequest(
            PullRequestUrl.of('https://github.com/acme/api/pull/7'),
          ),
        ],
      },
    });
  });

  it('tells a pull request closed without a merge from one merged', async () => {
    expect(
      await reading.read('pull_request', {
        action: 'closed',
        pull_request: pull({ merged: false }),
      }),
    ).toMatchObject({
      happening: Happening.of('github.pull_request.closed-unmerged'),
    });
  });

  it('reads a comment, and carries what was said', async () => {
    const read = await reading.read('pull_request_review_comment', {
      action: 'created',
      pull_request: pull(),
      comment: { body: 'This retries forever.' },
    });

    expect(read?.said?.body).toBe('This retries forever.');
  });

  it('carries the file and line a review comment points at', async () => {
    const read = await reading.read('pull_request_review_comment', {
      action: 'created',
      pull_request: pull(),
      comment: {
        body: 'This retries forever.',
        path: 'runner/internal/session/session.go',
        line: 42,
      },
    });

    expect(read?.said?.place).toBe('runner/internal/session/session.go:42');
  });

  it('carries the whole span where a comment covers several lines', async () => {
    const read = await reading.read('pull_request_review_comment', {
      action: 'created',
      pull_request: pull(),
      comment: {
        body: 'Extract this.',
        path: 'compose.yml',
        start_line: 10,
        line: 14,
      },
    });

    expect(read?.said?.place).toBe('compose.yml:10-14');
  });

  it('falls back to the line a comment was first left on', async () => {
    const read = await reading.read('pull_request_review_comment', {
      action: 'created',
      pull_request: pull(),
      comment: { body: 'Still here?', path: 'compose.yml', original_line: 7 },
    });

    expect(read?.said?.place).toBe('compose.yml:7');
  });

  it('reads a comment left on the pull request itself', async () => {
    expect(
      await reading.read('issue_comment', {
        action: 'created',
        issue: {
          pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
        },
        comment: { body: 'Ship it once the tests pass.' },
      }),
    ).toMatchObject({
      happening: Happening.of('github.pull_request.commented'),
      concerns: {
        taskId: null,
        marks: [
          Mark.pullRequest(
            PullRequestUrl.of('https://github.com/acme/api/pull/7'),
          ),
        ],
      },
    });
  });

  it('tells a review asking for changes from one merely saying something', async () => {
    const asked = await reading.read('pull_request_review', {
      action: 'submitted',
      pull_request: pull(),
      review: { state: 'changes_requested', body: 'Handle the empty case.' },
    });
    const said = await reading.read('pull_request_review', {
      action: 'submitted',
      pull_request: pull(),
      review: { state: 'commented', body: 'Reads well.' },
    });

    expect(asked).toMatchObject({
      happening: Happening.of('github.pull_request.changes-requested'),
    });
    expect(said).toMatchObject({
      happening: Happening.of('github.pull_request.commented'),
    });
  });

  it('reads a failing check suite by the branch it ran on', async () => {
    expect(
      await reading.read('check_suite', {
        action: 'completed',
        check_suite: { conclusion: 'failure', head_branch: 'spotlight/task_1' },
      }),
    ).toMatchObject({
      happening: Happening.of('github.checks.failed'),
      concerns: { taskId: TaskId.of('task_1'), marks: [] },
    });
  });

  it('says nothing of a check suite that passed', async () => {
    expect(
      await reading.read('check_suite', {
        action: 'completed',
        check_suite: { conclusion: 'success', head_branch: 'spotlight/task_1' },
      }),
    ).toBeNull();
  });

  it('marks what Spotlight itself did, so it does not answer itself', async () => {
    expect(
      await reading.read('issue_comment', {
        action: 'created',
        issue: {
          pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
        },
        comment: { body: 'Opened by the agent.', user: { type: 'Bot' } },
      }),
    ).toMatchObject({ ourOwn: true });
  });

  it('says nothing of an event it was not asked to read', async () => {
    expect(await reading.read('push', { pull_request: pull() })).toBeNull();
    expect(await events.read(delivered(undefined, {}))).toEqual([]);
  });

  it('refuses a delivery it should have understood and could not', async () => {
    await expect(
      reading.read('pull_request', {
        action: 'closed',
        pull_request: { merged: true },
      }),
    ).rejects.toThrow(UpstreamRefusedError);
  });

  describe('naming the delivery', () => {
    it('calls it what GitHub called it', async () => {
      expect(
        events.delivery(
          delivered('pull_request', {}, { 'x-github-delivery': 'd_1' }),
        ),
      ).toBe('d_1');
    });

    // Without one, the same word twice would be worked twice.
    it('falls back to the body, so an unnamed one is still the same one', async () => {
      const body = Buffer.from('{"action":"closed"}');
      const once = events.delivery({ headers: {}, body: {}, raw: body });
      const again = events.delivery({ headers: {}, body: {}, raw: body });

      expect(once).toBe(again);
      expect(once).toHaveLength(64);
    });
  });

  describe('noticing that configuration moved', () => {
    const pushed = (over: Record<string, unknown> = {}) =>
      delivered('push', {
        ref: 'refs/heads/main',
        repository: { full_name: 'acme/api', default_branch: 'main' },
        commits: [
          { added: [], removed: [], modified: ['.spotlight/config.yml'] },
        ],
        ...over,
      });

    it('notices a push that touched the configuration directory', async () => {
      expect(events.noticed(pushed())).toEqual([
        { kind: 'configuration-touched', repository: 'acme/api' },
      ]);
    });

    it('notices one that added or removed a file there', async () => {
      expect(
        events.noticed(
          pushed({
            commits: [{ added: ['.spotlight/integrations/linear.yml'] }],
          }),
        ),
      ).toHaveLength(1);
      expect(
        events.noticed({
          ...pushed({ commits: [{ removed: ['.spotlight/config.yml'] }] }),
        }),
      ).toHaveLength(1);
    });

    // Somebody's ordinary work, which this has no opinion about.
    it('notices nothing where the push touched nothing of ours', async () => {
      expect(
        events.noticed(pushed({ commits: [{ modified: ['src/main.ts'] }] })),
      ).toEqual([]);
    });

    // What is on the default branch is what the workspace has agreed to.
    it('notices nothing on a branch it does not read from', async () => {
      expect(events.noticed(pushed({ ref: 'refs/heads/topic' }))).toEqual([]);
    });

    it('notices nothing of any other event', async () => {
      expect(
        events.noticed(delivered('pull_request', { action: 'closed' })),
      ).toEqual([]);
    });

    it('notices nothing where the push names no repository', async () => {
      expect(events.noticed(pushed({ repository: {} }))).toEqual([]);
    });

    // Uninstalled on GitHub, so what the workspace holds for it opens nothing.
    it('notices an installation that was removed', async () => {
      expect(
        events.noticed(
          delivered('installation', {
            action: 'deleted',
            installation: { id: 158876513 },
          }),
        ),
      ).toEqual([
        {
          kind: 'connection-ended',
          source: 'github',
          externalId: '158876513',
        },
      ]);
    });

    // Installed, suspended, given another repository: still reachable.
    it('notices nothing of an installation that is still there', async () => {
      expect(
        events.noticed(
          delivered('installation', {
            action: 'created',
            installation: { id: 158876513 },
          }),
        ),
      ).toEqual([]);
    });

    it('notices nothing where the removal names no installation', async () => {
      expect(
        events.noticed(delivered('installation', { action: 'deleted' })),
      ).toEqual([]);
    });
  });

  describe('routing to a workspace', () => {
    it('asks whose the installation the delivery names is', async () => {
      const found = await events.routes(
        delivered('pull_request', { installation: { id: 42 } }),
      );

      expect(workspaces.withConnection).toHaveBeenCalledWith('github', '42');
      expect(found).toEqual(WorkspaceId.of('ws_1'));
    });

    // Not an App delivery, so there is nobody here it could be speaking for.
    it('routes a delivery that names no installation nowhere', async () => {
      expect(
        await events.routes(delivered('pull_request', { action: 'closed' })),
      ).toBeNull();
      expect(workspaces.withConnection).not.toHaveBeenCalled();
    });
  });
});
