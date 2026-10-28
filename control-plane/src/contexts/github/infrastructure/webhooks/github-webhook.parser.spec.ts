import { GitHubWebhookParser } from '@github/infrastructure/webhooks/github-webhook.parser';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { describe, expect, it } from 'vitest';

const parser = new GitHubWebhookParser();

const delivered = (
  event: string | undefined,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) => ({
  headers: { ...(event ? { 'x-github-event': event } : {}), ...headers },
  body,
  raw: null,
});

const eventsOf = (event: string | undefined, body: Record<string, unknown>) =>
  parser.parse(delivered(event, { installation: { id: 42 }, ...body })).events;

const activity = (event: string | undefined, body: Record<string, unknown>) =>
  eventsOf(event, body).flatMap((each) =>
    each.kind === 'pull-request-activity' ? [each.activity] : [],
  )[0] ?? null;

const pull = (over: Record<string, unknown> = {}) => ({
  merged: true,
  html_url: 'https://github.com/acme/api/pull/7',
  head: { ref: 'spotlight/task_1' },
  ...over,
});

describe('GitHubWebhookParser', () => {
  describe('reading pull request activity', () => {
    it('reads a merged pull request', () => {
      expect(
        activity('pull_request', { action: 'closed', pull_request: pull() }),
      ).toEqual({
        activity: 'merged',
        branch: 'spotlight/task_1',
        pullRequest: 'https://github.com/acme/api/pull/7',
        label: null,
        details: null,
        reviewComment: null,
        byBot: false,
      });
    });

    it('reads a pull request opened, reopened or ready for review', () => {
      for (const action of ['opened', 'reopened', 'ready_for_review']) {
        expect(
          activity('pull_request', {
            action,
            pull_request: pull({ merged: false }),
          }),
        ).toMatchObject({ activity: 'opened' });
      }
    });

    it('reads a pull request labelled, with the label it received', () => {
      expect(
        activity('pull_request', {
          action: 'labeled',
          label: { name: ' spotlight ' },
          pull_request: pull({ merged: false }),
        }),
      ).toMatchObject({ activity: 'labelled', label: 'spotlight' });
    });

    it('counts a label a bot added, since Spotlight adds none', () => {
      expect(
        activity('pull_request', {
          action: 'labeled',
          label: { name: 'spotlight' },
          sender: { type: 'Bot' },
          pull_request: pull({ merged: false }),
        }),
      ).toMatchObject({ activity: 'labelled', byBot: false });
    });

    it('carries no label on activity other than labelling', () => {
      expect(
        activity('pull_request', {
          action: 'opened',
          label: { name: 'spotlight' },
          pull_request: pull({ merged: false }),
        }),
      ).toMatchObject({ activity: 'opened', label: null });
    });

    it('says nothing of a pull request edited or pushed to', () => {
      for (const action of ['edited', 'synchronize']) {
        expect(
          activity('pull_request', { action, pull_request: pull() }),
        ).toBeNull();
      }
    });

    it('says what the pull request is, who opened it and whether it is a draft', () => {
      expect(
        activity('pull_request', {
          action: 'opened',
          pull_request: pull({
            merged: false,
            title: ' Retry uploads ',
            body: 'Uploads give up too soon.',
            draft: true,
            user: { login: 'octocat' },
            author_association: 'MEMBER',
          }),
        })?.details,
      ).toEqual({
        title: 'Retry uploads',
        body: 'Uploads give up too soon.',
        author: 'octocat',
        authorAssociation: 'MEMBER',
        draft: true,
      });
    });

    it('passes on how GitHub associates the author with the repository, as GitHub names it', () => {
      for (const association of ['OWNER', 'CONTRIBUTOR', 'NONE']) {
        expect(
          activity('pull_request', {
            action: 'opened',
            pull_request: pull({
              title: 'Retry uploads',
              author_association: association,
            }),
          })?.details?.authorAssociation,
        ).toBe(association);
      }
    });

    it('reads whether the author of a pull request commented on belongs to the repository', () => {
      expect(
        activity('issue_comment', {
          action: 'created',
          issue: {
            title: 'Retry uploads',
            user: { login: 'octocat' },
            author_association: 'COLLABORATOR',
            pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
          },
          comment: { body: '@spotlight have a look' },
        })?.details?.authorAssociation,
      ).toBe('COLLABORATOR');
    });

    it('reads no association where GitHub sends none', () => {
      for (const association of [undefined, 7, ' ']) {
        expect(
          activity('pull_request', {
            action: 'opened',
            pull_request: pull({
              title: 'Retry uploads',
              author_association: association,
            }),
          })?.details?.authorAssociation,
        ).toBeNull();
      }
    });

    it('reads a pull request a bot opened, since opening one is not answering itself', () => {
      expect(
        activity('pull_request', {
          action: 'opened',
          pull_request: pull({ merged: false }),
          sender: { type: 'Bot' },
        }),
      ).toMatchObject({ activity: 'opened', byBot: false });
    });

    it('says what the pull request a comment was left on is', () => {
      expect(
        activity('issue_comment', {
          action: 'created',
          issue: {
            title: 'Retry uploads',
            user: { login: 'octocat' },
            pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
          },
          comment: { body: '@spotlight have a look' },
        })?.details,
      ).toEqual({
        title: 'Retry uploads',
        body: null,
        author: 'octocat',
        authorAssociation: null,
        draft: false,
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
        reviewComment: { body: 'This retries forever.', id: 'PRRC_1' },
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
        })?.reviewComment,
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
        })?.reviewComment,
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
        })?.reviewComment,
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

    it('tells a review requesting changes from one merely saying something', () => {
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
        reviewComment: { body: 'Handle the empty case.' },
      });
      expect(
        activity('pull_request_review', {
          action: 'submitted',
          pull_request: pull(),
          review: { state: 'commented', body: 'Reads well.' },
        }),
      ).toMatchObject({ activity: 'commented' });
    });

    it('reads a submitted review, its state, who wrote it and when', () => {
      expect(
        eventsOf('pull_request_review', {
          action: 'submitted',
          pull_request: pull(),
          review: {
            state: 'APPROVED',
            body: '',
            user: { login: 'ada', type: 'User' },
            submitted_at: '2026-09-21T09:30:00Z',
          },
        }).filter((each) => each.kind === 'pull-request-reviewed'),
      ).toEqual([
        {
          kind: 'pull-request-reviewed',
          pullRequest: 'https://github.com/acme/api/pull/7',
          id: null,
          snapshot: null,
          state: 'approved',
          login: 'ada',
          byBot: false,
          submittedAt: new Date('2026-09-21T09:30:00Z'),
        },
      ]);
    });

    it('reads no review that was only edited or dismissed', () => {
      for (const action of ['edited', 'dismissed']) {
        expect(
          eventsOf('pull_request_review', {
            action,
            pull_request: pull(),
            review: { state: 'approved', user: { login: 'ada' } },
          }).filter((each) => each.kind === 'pull-request-reviewed'),
        ).toEqual([]);
      }
    });

    it('reads no review in a state GitHub never sends, even one named like a property every object has', () => {
      for (const state of ['constructor', 'toString', 'pending']) {
        expect(
          eventsOf('pull_request_review', {
            action: 'submitted',
            pull_request: pull(),
            review: { state, user: { login: 'ada' } },
          }).filter((each) => each.kind === 'pull-request-reviewed'),
        ).toEqual([]);
      }
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

    it('says nothing of an event it was not told to read', () => {
      expect(activity('push', { pull_request: pull() })).toBeNull();
      expect(parser.parse(delivered(undefined, {})).events).toEqual([]);
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
        parser.idOf(
          delivered('pull_request', {}, { 'x-github-delivery': 'd_1' }),
        ),
      ).toBe('d_1');
    });

    it('falls back to the body, so an unnamed one is still the same one', () => {
      const body = Buffer.from('{"action":"closed"}');
      const once = parser.idOf({ headers: {}, body: {}, raw: body });
      const again = parser.idOf({ headers: {}, body: {}, raw: body });

      expect(once).toBe(again);
      expect(once).toHaveLength(64);
    });

    it('finds the signature GitHub sent', () => {
      expect(
        parser.signatureOf(
          delivered('push', {}, { 'x-hub-signature-256': 'sha256=abc' }),
        ),
      ).toBe('sha256=abc');
    });
  });

  describe('naming the installation', () => {
    it('reads the installation a delivery came through', () => {
      expect(
        parser.parse(delivered('push', { installation: { id: 158876513 } }))
          .installation,
      ).toBe('158876513');
    });

    it('names none where the delivery names none', () => {
      expect(
        parser.parse(delivered('pull_request', { action: 'closed' }))
          .installation,
      ).toBeNull();
    });
  });

  describe('reading a pull request close', () => {
    const closed = (over: Record<string, unknown> = {}) =>
      eventsOf('pull_request', {
        action: 'closed',
        repository: { full_name: 'acme/api' },
        pull_request: pull({
          id: 707,
          merge_commit_sha: 'c'.repeat(40),
          closed_at: '2026-09-21T09:30:00Z',
        }),
        ...over,
      }).filter((each) => each.kind === 'pull-request-closed');

    it('reads a merge, with the commit it made and when', () => {
      expect(closed()).toEqual([
        {
          kind: 'pull-request-closed',
          pullRequest: 'https://github.com/acme/api/pull/7',
          repository: 'acme/api',
          gitHubId: 707,
          merge: { commit: 'c'.repeat(40) },
          closedAt: new Date('2026-09-21T09:30:00Z'),
        },
      ]);
    });

    it('reads a close without a merge, naming no commit', () => {
      expect(
        closed({
          pull_request: pull({
            merged: false,
            merge_commit_sha: 'd'.repeat(40),
          }),
        }),
      ).toMatchObject([{ merge: null }]);
    });

    it('reads nothing of a merge that names no full commit', () => {
      expect(
        closed({ pull_request: pull({ merge_commit_sha: null }) }),
      ).toEqual([]);
      expect(
        closed({ pull_request: pull({ merge_commit_sha: 'abc123' }) }),
      ).toEqual([]);
    });

    it('reads nothing of a pull request still open', () => {
      expect(closed({ action: 'opened' })).toEqual([]);
    });

    it('reads a reopen, with the GitHub id of the pull request', () => {
      expect(
        eventsOf('pull_request', {
          action: 'reopened',
          repository: { full_name: 'acme/api' },
          pull_request: pull({ id: 707, updated_at: '2026-09-22T09:30:00Z' }),
        }).filter((each) => each.kind === 'pull-request-reopened'),
      ).toEqual([
        {
          kind: 'pull-request-reopened',
          pullRequest: 'https://github.com/acme/api/pull/7',
          repository: 'acme/api',
          gitHubId: 707,
          reopenedAt: new Date('2026-09-22T09:30:00Z'),
        },
      ]);
    });
  });

  describe('reading what a pull request is', () => {
    const snapshotIn = (
      body: Record<string, unknown>,
      event = 'pull_request',
    ) =>
      eventsOf(event, {
        repository: { full_name: 'acme/api' },
        ...body,
      }).flatMap((each) =>
        each.kind === 'pull-request' ? [each.snapshot] : [],
      );

    const OPEN = {
      number: 7,
      state: 'open',
      merged: false,
      title: 'Retry failed uploads',
      body: 'So they stop failing.',
      html_url: 'https://github.com/acme/api/pull/7',
      user: { login: 'ada', type: 'User' },
      head: { ref: 'fix/uploads' },
      created_at: '2026-09-20T08:00:00Z',
      updated_at: '2026-09-20T09:00:00Z',
      additions: 40,
      deletions: 3,
      changed_files: 2,
    };

    it('reads every pull request event as what the pull request now is, whether or not a task owns it', () => {
      for (const action of ['opened', 'edited', 'synchronize', 'reopened']) {
        expect(snapshotIn({ action, pull_request: OPEN })).toEqual([
          {
            url: PullRequestUrl.of('https://github.com/acme/api/pull/7'),
            repository: Repository.of('acme/api'),
            number: 7,
            title: 'Retry failed uploads',
            body: 'So they stop failing.',
            author: 'ada',
            authorIsBot: false,
            branch: 'fix/uploads',
            size: { additions: 40, deletions: 3, changedFiles: 2 },
            openedAt: new Date('2026-09-20T08:00:00Z'),
            draft: false,
            markedReadyAt: null,
            markedDraftAt: null,
            state: 'open',
            closedAt: null,
            updatedAt: new Date('2026-09-20T09:00:00Z'),
          },
        ]);
      }
    });

    it('reads a draft, and when GitHub marked it ready for review or turned it back into a draft', () => {
      expect(
        snapshotIn({
          action: 'opened',
          pull_request: { ...OPEN, draft: true },
        }),
      ).toMatchObject([{ draft: true, markedReadyAt: null }]);
      expect(
        snapshotIn({
          action: 'ready_for_review',
          pull_request: {
            ...OPEN,
            draft: false,
            updated_at: '2026-09-20T11:00:00Z',
          },
        }),
      ).toMatchObject([
        { draft: false, markedReadyAt: new Date('2026-09-20T11:00:00Z') },
      ]);
      expect(
        snapshotIn({
          action: 'converted_to_draft',
          pull_request: {
            ...OPEN,
            draft: true,
            updated_at: '2026-09-20T12:00:00Z',
          },
        }),
      ).toMatchObject([
        {
          draft: true,
          markedReadyAt: null,
          markedDraftAt: new Date('2026-09-20T12:00:00Z'),
        },
      ]);
    });

    it('reads a merge as merged, when it merged', () => {
      expect(
        snapshotIn({
          action: 'closed',
          pull_request: {
            ...OPEN,
            state: 'closed',
            merged: true,
            merged_at: '2026-09-21T09:30:00Z',
            closed_at: '2026-09-21T09:30:01Z',
          },
        }),
      ).toMatchObject([
        { state: 'merged', closedAt: new Date('2026-09-21T09:30:00Z') },
      ]);
    });

    it('reads a close without a merge as closed', () => {
      expect(
        snapshotIn({
          action: 'closed',
          pull_request: {
            ...OPEN,
            state: 'closed',
            closed_at: '2026-09-21T09:30:00Z',
          },
        }),
      ).toMatchObject([
        { state: 'closed', closedAt: new Date('2026-09-21T09:30:00Z') },
      ]);
    });

    it('reads a bot author, and no size where GitHub sends none', () => {
      expect(
        snapshotIn({
          action: 'opened',
          pull_request: {
            ...OPEN,
            user: { login: 'dependabot[bot]', type: 'Bot' },
            additions: undefined,
          },
        }),
      ).toMatchObject([{ authorIsBot: true, size: null }]);
    });

    it('reads nothing of a pull request it cannot name', () => {
      expect(
        snapshotIn({
          action: 'opened',
          pull_request: { ...OPEN, number: null },
        }),
      ).toEqual([]);
      expect(
        snapshotIn({ action: 'opened', pull_request: OPEN, repository: {} }),
      ).toEqual([]);
    });

    it('reads nothing of a pull request whose address names another repository or number', () => {
      expect(
        snapshotIn({
          action: 'opened',
          pull_request: OPEN,
          repository: { full_name: 'acme/web' },
        }),
      ).toEqual([]);
      expect(
        snapshotIn({ action: 'opened', pull_request: { ...OPEN, number: 8 } }),
      ).toEqual([]);
      expect(
        snapshotIn({
          action: 'opened',
          pull_request: OPEN,
          repository: { full_name: 'Acme/API' },
        }),
      ).toHaveLength(1);
    });

    it('reads a dismissed review by its id, with what the pull request is', () => {
      expect(
        eventsOf('pull_request_review', {
          action: 'dismissed',
          repository: { full_name: 'acme/api' },
          pull_request: OPEN,
          review: {
            id: 900,
            state: 'dismissed',
            user: { login: 'bob', type: 'User' },
          },
        }).filter((each) => each.kind === 'pull-request-review-dismissed'),
      ).toMatchObject([
        {
          pullRequest: 'https://github.com/acme/api/pull/7',
          id: 900,
          snapshot: { number: 7 },
        },
      ]);
    });

    it('carries what the pull request is along with a review, and the review’s id', () => {
      expect(
        eventsOf('pull_request_review', {
          action: 'submitted',
          repository: { full_name: 'acme/api' },
          pull_request: OPEN,
          review: {
            id: 900,
            state: 'changes_requested',
            user: { login: 'bob', type: 'User' },
            submitted_at: '2026-09-21T09:30:00Z',
          },
        }).find((each) => each.kind === 'pull-request-reviewed'),
      ).toMatchObject({
        id: 900,
        login: 'bob',
        byBot: false,
        snapshot: { number: 7, state: 'open' },
      });
    });

    it('tells a bot’s review comment from a person’s', () => {
      expect(
        eventsOf('pull_request_review_comment', {
          action: 'created',
          repository: { full_name: 'acme/api' },
          pull_request: OPEN,
          comment: {
            id: 301,
            html_url: 'https://github.com/acme/api/pull/7#discussion_r301',
            path: 'src/a.ts',
            body: 'Nit.',
            user: { login: 'linter[bot]', type: 'Bot' },
          },
        }).find((each) => each.kind === 'review-comment'),
      ).toMatchObject({ comment: { byBot: true }, snapshot: { number: 7 } });
    });
  });

  describe('reading a review comment', () => {
    const commented = (action: string, comment: Record<string, unknown>) =>
      eventsOf('pull_request_review_comment', {
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

    it('reads a review comment made, changed or deleted on a pull request', () => {
      expect(commented('created', COMMENT)).toEqual([
        {
          kind: 'review-comment',
          action: 'created',
          pullRequest: pull().html_url,
          comment: {
            id: 300,
            url: 'https://github.com/acme/api/pull/7#discussion_r300',
            path: 'src/a.ts',
            subject: 'line',
            side: 'new',
            line: 12,
            startLine: 9,
            body: 'Why not a constant?',
            inReplyToId: 200,
            login: 'octocat',
            byBot: false,
            writtenAt: new Date('2026-09-16T09:00:00Z'),
          },
          snapshot: null,
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
        comment: { side: 'old', line: 4, inReplyToId: null, writtenAt: null },
      });
    });

    it('reads a comment left on the whole file as one', () => {
      expect(
        commented('created', {
          id: 302,
          html_url: 'https://github.com/acme/api/pull/7#discussion_r302',
          path: 'src/a.ts',
          subject_type: 'file',
          line: null,
          body: 'This file wants splitting',
        })[0],
      ).toMatchObject({ comment: { subject: 'file' } });
      expect(
        commented('created', {
          id: 302,
          html_url: 'https://github.com/acme/api/pull/7#discussion_r302',
          path: 'src/a.ts',
          subject_type: 'file',
          line: null,
          body: 'This file wants splitting',
        })[0]?.comment,
      ).not.toHaveProperty('line');
    });

    it('reads what Spotlight said without its byline', () => {
      const bylined = {
        ...COMMENT,
        body: '**Ada** via Spotlight:\n\nWhy not a constant?',
      };

      expect(
        commented('edited', { ...bylined, user: { type: 'Bot' } })[0],
      ).toMatchObject({ comment: { body: 'Why not a constant?' } });
      expect(commented('edited', bylined)[0]).toMatchObject({
        comment: { body: bylined.body },
      });
    });

    it('reads no review comment in any other event', () => {
      expect(
        eventsOf('pull_request', {
          action: 'closed',
          pull_request: pull(),
        }).map((each) => each.kind),
      ).toEqual(['pull-request-activity']);
    });
  });

  describe('reading a conversation comment', () => {
    const conversed = (action: string, body: Record<string, unknown> = {}) =>
      eventsOf('issue_comment', {
        action,
        issue: {
          title: 'Retry failed uploads',
          pull_request: { html_url: 'https://github.com/acme/api/pull/7' },
        },
        comment: {
          id: 500,
          body: 'Summary of changes',
          user: { login: 'coderabbitai[bot]', type: 'Bot' },
        },
        ...body,
      }).filter((each) => each.kind === 'conversation-comment');

    it('reads a comment made, changed or deleted on a pull request’s conversation', () => {
      expect(conversed('created')).toEqual([
        {
          kind: 'conversation-comment',
          action: 'created',
          pullRequest: 'https://github.com/acme/api/pull/7',
          comment: { id: 500, login: 'coderabbitai[bot]', byBot: true },
        },
      ]);
      expect(conversed('deleted')[0]).toMatchObject({ action: 'deleted' });
      expect(conversed('pinned')).toEqual([]);
    });

    it('reads nothing of a comment on an issue that is not a pull request', () => {
      expect(conversed('created', { issue: { title: 'Bug' } })).toEqual([]);
    });
  });

  describe('reading a review thread', () => {
    const threaded = (action: string, thread: Record<string, unknown>) =>
      eventsOf('pull_request_review_thread', {
        action,
        repository: { full_name: 'acme/api' },
        pull_request: pull(),
        thread,
      }).filter((each) => each.kind === 'review-thread');

    const THREAD = {
      node_id: 'PRRT_kwDOA',
      comments: [
        { id: 300, user: { login: 'coderabbitai[bot]', type: 'Bot' } },
        { id: 301, user: { login: 'ada', type: 'User' } },
      ],
    };

    it('reads a thread resolved or unresolved, and who opened it', () => {
      expect(threaded('resolved', THREAD)).toEqual([
        {
          kind: 'review-thread',
          pullRequest: 'https://github.com/acme/api/pull/7',
          thread: {
            id: 'PRRT_kwDOA',
            firstCommentId: 300,
            login: 'coderabbitai[bot]',
            byBot: true,
            resolved: true,
          },
          snapshot: null,
        },
      ]);
      expect(threaded('unresolved', THREAD)[0]).toMatchObject({
        thread: { resolved: false },
      });
    });

    it('reads a thread whose comments GitHub left out, and nothing of one it cannot name', () => {
      expect(threaded('resolved', { node_id: 'PRRT_kwDOB' })[0]).toMatchObject({
        thread: { firstCommentId: null, login: null, byBot: false },
      });
      expect(threaded('resolved', { comments: THREAD.comments })).toEqual([]);
      expect(threaded('created', THREAD)).toEqual([]);
    });
  });

  describe('reading an installation', () => {
    it('reads one that was removed', () => {
      expect(eventsOf('installation', { action: 'deleted' })).toEqual([
        { kind: 'installation-removed' },
      ]);
    });

    it('reads nothing of one that is still there', () => {
      expect(eventsOf('installation', { action: 'created' })).toEqual([]);
    });
  });
});
