import type { Heard } from '@github/application/ports/webhook-translation.port';
import { GitHubWebhookTranslation } from '@github/infrastructure/webhooks/github-webhook.translation';
import { describe, expect, it } from 'vitest';

const translation = new GitHubWebhookTranslation();

const delivered = (
  event: string | undefined,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) => ({
  headers: { ...(event ? { 'x-github-event': event } : {}), ...headers },
  body,
  raw: null,
});

const heard = (event: string | undefined, body: Record<string, unknown>) =>
  translation.translated(
    delivered(event, { installation: { id: 42 }, ...body }),
  ).heard;

const activity = (event: string | undefined, body: Record<string, unknown>) =>
  heard(event, body).flatMap((each) =>
    each.kind === 'pull-request-activity' ? [each.activity] : [],
  )[0] ?? null;

const pull = (over: Record<string, unknown> = {}) => ({
  merged: true,
  html_url: 'https://github.com/acme/api/pull/7',
  head: { ref: 'spotlight/task_1' },
  ...over,
});

describe('GitHubWebhookTranslation', () => {
  describe('reading pull request activity', () => {
    it('reads a merged pull request', () => {
      expect(
        activity('pull_request', { action: 'closed', pull_request: pull() }),
      ).toEqual({
        activity: 'merged',
        branch: 'spotlight/task_1',
        pullRequest: 'https://github.com/acme/api/pull/7',
        remark: null,
        byBot: false,
      });
    });

    it('tells a pull request closed without a merge from one merged', () => {
      expect(
        activity('pull_request', {
          action: 'closed',
          pull_request: pull({ merged: false }),
        }),
      ).toMatchObject({ activity: 'closed-unmerged' });
    });

    it('reads a comment, and carries what was said', () => {
      expect(
        activity('pull_request_review_comment', {
          action: 'created',
          pull_request: pull(),
          comment: { body: 'This retries forever.', node_id: 'PRRC_1' },
        }),
      ).toMatchObject({
        activity: 'commented',
        remark: { body: 'This retries forever.', id: 'PRRC_1' },
      });
    });

    it('carries the file and line a review comment points at', () => {
      expect(
        activity('pull_request_review_comment', {
          action: 'created',
          pull_request: pull(),
          comment: {
            body: 'This retries forever.',
            path: 'runner/internal/session/session.go',
            line: 42,
          },
        })?.remark,
      ).toMatchObject({
        path: 'runner/internal/session/session.go',
        from: 42,
        to: null,
      });
    });

    it('carries the whole span where a comment covers several lines', () => {
      expect(
        activity('pull_request_review_comment', {
          action: 'created',
          pull_request: pull(),
          comment: {
            body: 'Extract this.',
            path: 'compose.yml',
            start_line: 10,
            line: 14,
          },
        })?.remark,
      ).toMatchObject({ path: 'compose.yml', from: 10, to: 14 });
    });

    it('falls back to the line a comment was first left on', () => {
      expect(
        activity('pull_request_review_comment', {
          action: 'created',
          pull_request: pull(),
          comment: {
            body: 'Still here?',
            path: 'compose.yml',
            original_line: 7,
          },
        })?.remark,
      ).toMatchObject({ path: 'compose.yml', from: 7 });
    });

    it('reads a comment left on the pull request itself', () => {
      expect(
        activity('issue_comment', {
          action: 'created',
          issue: {
            pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
          },
          comment: { body: 'Ship it once the tests pass.' },
        }),
      ).toMatchObject({
        activity: 'commented',
        branch: null,
        pullRequest: 'https://github.com/acme/api/pull/7',
      });
    });

    it('tells a review asking for changes from one merely saying something', () => {
      expect(
        activity('pull_request_review', {
          action: 'submitted',
          pull_request: pull(),
          review: {
            state: 'changes_requested',
            body: 'Handle the empty case.',
          },
        }),
      ).toMatchObject({
        activity: 'changes-requested',
        remark: { body: 'Handle the empty case.' },
      });
      expect(
        activity('pull_request_review', {
          action: 'submitted',
          pull_request: pull(),
          review: { state: 'commented', body: 'Reads well.' },
        }),
      ).toMatchObject({ activity: 'commented' });
    });

    it('reads a failing check suite by the branch it ran on', () => {
      expect(
        activity('check_suite', {
          action: 'completed',
          check_suite: {
            conclusion: 'failure',
            head_branch: 'spotlight/task_1',
          },
        }),
      ).toMatchObject({
        activity: 'checks-failed',
        branch: 'spotlight/task_1',
        pullRequest: null,
      });
    });

    it('says nothing of a check suite that passed', () => {
      expect(
        activity('check_suite', {
          action: 'completed',
          check_suite: {
            conclusion: 'success',
            head_branch: 'spotlight/task_1',
          },
        }),
      ).toBeNull();
    });

    it('marks what a bot did, so Spotlight does not answer itself', () => {
      expect(
        activity('issue_comment', {
          action: 'created',
          issue: {
            pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
          },
          comment: { body: 'Opened by the agent.', user: { type: 'Bot' } },
        }),
      ).toMatchObject({ byBot: true });
    });

    it('says nothing of an event it was not asked to read', () => {
      expect(activity('push', { pull_request: pull() })).toBeNull();
      expect(translation.translated(delivered(undefined, {})).heard).toEqual(
        [],
      );
    });

    it('still reads a delivery that names neither branch nor pull request', () => {
      expect(
        activity('pull_request', {
          action: 'closed',
          pull_request: { merged: true },
        }),
      ).toMatchObject({ activity: 'merged', branch: null, pullRequest: null });
    });
  });

  describe('naming the delivery', () => {
    it('calls it what GitHub called it', () => {
      expect(
        translation.idOf(
          delivered('pull_request', {}, { 'x-github-delivery': 'd_1' }),
        ),
      ).toBe('d_1');
    });

    it('falls back to the body, so an unnamed one is still the same one', () => {
      const body = Buffer.from('{"action":"closed"}');
      const once = translation.idOf({ headers: {}, body: {}, raw: body });
      const again = translation.idOf({ headers: {}, body: {}, raw: body });

      expect(once).toBe(again);
      expect(once).toHaveLength(64);
    });

    it('finds the signature GitHub sent', () => {
      expect(
        translation.signatureOf(
          delivered('push', {}, { 'x-hub-signature-256': 'sha256=abc' }),
        ),
      ).toBe('sha256=abc');
    });
  });

  describe('naming the installation', () => {
    it('reads the installation a delivery came through', () => {
      expect(
        translation.translated(
          delivered('push', { installation: { id: 158876513 } }),
        ).installation,
      ).toBe('158876513');
    });

    it('names none where the delivery names none', () => {
      expect(
        translation.translated(delivered('pull_request', { action: 'closed' }))
          .installation,
      ).toBeNull();
    });
  });

  describe('hearing a push', () => {
    const pushed = (over: Record<string, unknown> = {}) =>
      heard('push', {
        ref: 'refs/heads/main',
        repository: { full_name: 'acme/api', default_branch: 'main' },
        commits: [
          { added: [], removed: [], modified: ['.spotlight/config.yml'] },
        ],
        ...over,
      });

    it('hears a push to the default branch, with every path it touched', () => {
      expect(
        pushed({
          commits: [
            { added: ['.spotlight/integrations/linear.yml'] },
            { removed: ['src/main.ts'], modified: ['src/main.ts'] },
          ],
        }),
      ).toEqual([
        {
          kind: 'default-branch-pushed',
          repository: 'acme/api',
          paths: ['.spotlight/integrations/linear.yml', 'src/main.ts'],
        },
      ] satisfies Heard[]);
    });

    it('hears nothing on a branch other than the default', () => {
      expect(pushed({ ref: 'refs/heads/topic' })).toEqual([]);
    });

    it('hears nothing where the push names no repository', () => {
      expect(pushed({ repository: {} })).toEqual([]);
    });

    it('hears nothing where the push touched no file', () => {
      expect(pushed({ commits: [] })).toEqual([]);
    });
  });

  describe('hearing a review comment', () => {
    const commented = (action: string, comment: Record<string, unknown>) =>
      heard('pull_request_review_comment', {
        action,
        pull_request: pull(),
        comment,
      }).filter((each) => each.kind === 'review-comment');

    const COMMENT = {
      id: 300,
      html_url: 'https://github.com/acme/api/pull/7#discussion_r300',
      path: 'src/a.ts',
      line: 12,
      original_line: 11,
      start_line: 9,
      side: 'RIGHT',
      body: 'Why not a constant?',
      in_reply_to_id: 200,
      user: { login: 'octocat' },
      created_at: '2026-09-16T09:00:00Z',
    };

    it('hears a review comment made, changed or deleted on a pull request', () => {
      expect(commented('created', COMMENT)).toEqual([
        {
          kind: 'review-comment',
          action: 'created',
          pullRequest: pull().html_url,
          comment: {
            id: 300,
            url: 'https://github.com/acme/api/pull/7#discussion_r300',
            path: 'src/a.ts',
            side: 'new',
            line: 12,
            startLine: 9,
            body: 'Why not a constant?',
            answers: 200,
            login: 'octocat',
            writtenAt: new Date('2026-09-16T09:00:00Z'),
          },
        },
      ]);
      expect(commented('deleted', COMMENT)[0]).toMatchObject({
        action: 'deleted',
      });
      expect(commented('resolved', COMMENT)).toEqual([]);
    });

    it('reads the old side and the line it was first left on', () => {
      expect(
        commented('created', {
          id: 301,
          html_url: 'https://github.com/acme/api/pull/7#discussion_r301',
          path: 'src/a.ts',
          line: null,
          original_line: 4,
          side: 'LEFT',
          body: 'Gone now',
        })[0],
      ).toMatchObject({
        comment: { side: 'old', line: 4, answers: null, writtenAt: null },
      });
    });

    it('hears what Spotlight said without the name it signed it with', () => {
      const signed = {
        ...COMMENT,
        body: '**Ada** via Spotlight:\n\nWhy not a constant?',
      };

      expect(
        commented('edited', { ...signed, user: { type: 'Bot' } })[0],
      ).toMatchObject({ comment: { body: 'Why not a constant?' } });
      expect(commented('edited', signed)[0]).toMatchObject({
        comment: { body: signed.body },
      });
    });

    it('hears no review comment in any other event', () => {
      expect(
        heard('pull_request', { action: 'closed', pull_request: pull() }).map(
          (each) => each.kind,
        ),
      ).toEqual(['pull-request-activity']);
    });
  });

  describe('hearing an installation', () => {
    it('hears one that was removed', () => {
      expect(heard('installation', { action: 'deleted' })).toEqual([
        { kind: 'installation-removed' },
      ]);
    });

    it('hears nothing of one that is still there', () => {
      expect(heard('installation', { action: 'created' })).toEqual([]);
    });
  });
});
