import {
  PullRequest,
  type PullRequestComment,
  type PullRequestSnapshot,
} from '@github/domain/aggregates/pull-request.aggregate';
import { PullRequestClosed } from '@github/domain/events/pull-request-closed.event';
import type { PullRequestUpdated } from '@github/domain/events/pull-request-updated.event';
import { ReviewCommentReceived } from '@github/domain/events/review-comment-received.event';
import { BotComment } from '@github/domain/value-objects/bot-comment.vo';
import { PullRequestReview } from '@github/domain/value-objects/pull-request-review.vo';
import { PullRequestThread } from '@github/domain/value-objects/pull-request-thread.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const URL_7 = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const OPENED = new Date('2026-09-20T08:00:00Z');
const MERGED = new Date('2026-09-21T09:00:00Z');
const NOW = new Date('2026-09-25T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const snapshotOf = (
  over: Partial<PullRequestSnapshot> = {},
): PullRequestSnapshot => ({
  url: URL_7,
  repository: Repository.of('acme/api'),
  number: 7,
  title: 'Retry failed uploads',
  body: null,
  author: 'ada',
  authorIsBot: false,
  branch: 'fix/uploads',
  size: { additions: 40, deletions: 3, changedFiles: 2 },
  openedAt: OPENED,
  draft: false,
  markedReadyAt: null,
  markedDraftAt: null,
  state: 'open',
  closedAt: null,
  updatedAt: null,
  ...over,
});

const at = (hour: number) =>
  new Date(`2026-09-20T${String(hour).padStart(2, '0')}:00:00Z`);

const review = (
  id: number,
  state: PullRequestReview['state'],
  hour: number,
  byBot = false,
  login = byBot ? 'coderabbitai[bot]' : 'grace',
): PullRequestReview =>
  PullRequestReview.of({ id, state, login, byBot, at: at(hour) });

const comment = (
  id: number,
  action: PullRequestComment['action'],
  over: Partial<PullRequestComment> = {},
): PullRequestComment => ({
  id,
  on: 'line',
  action,
  login: over.byBot ? 'coderabbitai[bot]' : 'grace',
  inReplyToId: null,
  byBot: false,
  details: null,
  ...over,
});

const thread = (
  id: string,
  resolved: boolean,
  over: Partial<Parameters<typeof PullRequestThread.of>[0]> = {},
): PullRequestThread =>
  PullRequestThread.of({
    id,
    firstCommentId: null,
    login: 'coderabbitai[bot]',
    byBot: true,
    resolved,
    ...over,
  });

const stored = (pullRequest: PullRequest) =>
  PullRequest.rehydrate({
    workspaceId: pullRequest.workspaceId,
    url: pullRequest.url,
    repository: pullRequest.repository,
    number: pullRequest.number,
    title: pullRequest.title,
    author: pullRequest.author,
    authorIsBot: pullRequest.authorIsBot,
    branch: pullRequest.branch,
    size: pullRequest.size,
    openedAt: pullRequest.openedAt,
    draft: pullRequest.draft,
    readyForReviewAt: pullRequest.readyForReviewAt,
    draftPeriods: pullRequest.draftPeriods,
    state: pullRequest.state,
    closedAt: pullRequest.closedAt,
    updatedAt: pullRequest.updatedAt,
    reverts: pullRequest.reverts,
    reviews: pullRequest.reviews,
    dismissedReviews: pullRequest.dismissedReviews,
    comments: pullRequest.comments,
    deletedComments: pullRequest.deletedComments,
    botComments: pullRequest.botComments,
    threads: pullRequest.threads,
    revertedBy: pullRequest.revertedBy,
    version: pullRequest.isStored
      ? pullRequest.version + 1
      : pullRequest.version,
  });

const received = (over: Partial<PullRequestSnapshot> = {}) => {
  const first = PullRequest.fromWebhook(WORKSPACE, snapshotOf(over), NOW);

  if (!first) {
    throw new Error('Expected the pull request to be updated');
  }

  return first;
};

const opened = (over: Partial<PullRequestSnapshot> = {}) =>
  stored(received(over));

const kinds = (pullRequest: PullRequest) =>
  pullRequest.pullEvents().map((each) => each.kind);

const updated = (pullRequest: PullRequest) =>
  (
    pullRequest
      .pullEvents()
      .find((each) => each.kind === 'pull-request.updated') as
      | PullRequestUpdated
      | undefined
  )?.updated;

describe('PullRequest', () => {
  it('records what it received about a pull request, whether or not a task owns it', () => {
    expect(updated(received())).toMatchObject({
      pullRequest: URL_7,
      repository: Repository.of('acme/api'),
      number: 7,
      author: 'ada',
      additions: 40,
      state: 'open',
      reviews: [],
      reviewComments: 0,
      isRevert: false,
      version: 0,
    });
  });

  it('records each change once, at the version it will be stored as', () => {
    const changed = opened()
      .recordReview(review(1, 'commented', 9))
      .recordReview(review(2, 'approved', 10));

    const events = changed.pullEvents();

    expect(events.map((each) => each.kind)).toEqual(['pull-request.updated']);
    expect(
      (
        events.find(
          (each) => each.kind === 'pull-request.updated',
        ) as PullRequestUpdated
      ).updated,
    ).toMatchObject({
      reviews: [review(1, 'commented', 9), review(2, 'approved', 10)],
      version: 1,
    });
  });

  it('changes nothing where it receives what it already has', () => {
    const original = opened();
    const reviewed = stored(original.recordReview(review(1, 'approved', 9)));

    expect(original.updateFrom(snapshotOf())).toBe(original);
    expect(reviewed.recordReview(review(1, 'approved', 9))).toBe(reviewed);
  });

  it('keeps a merged pull request merged, whatever it receives after', () => {
    const merged = opened().updateFrom(
      snapshotOf({ state: 'merged', closedAt: MERGED }),
    );
    const after = stored(merged).updateFrom(
      snapshotOf({ state: 'closed', closedAt: at(23), title: 'Renamed' }),
    );

    expect(after.state).toBe('merged');
    expect(after.closedAt).toEqual(MERGED);
    expect(after.title).toBe('Renamed');
  });

  it('keeps the size it knows where it later receives none', () => {
    expect(
      opened().updateFrom(snapshotOf({ size: null, title: 'New' })).size,
    ).toEqual({ additions: 40, deletions: 3, changedFiles: 2 });
  });

  it('keeps its repository in lower case, however GitHub spells it', () => {
    expect(
      opened({ repository: Repository.of('Acme/API') }).repository,
    ).toEqual(Repository.of('acme/api'));
  });

  it('ignores what GitHub said before what it already received, however late it arrives', () => {
    const newer = opened({ title: 'Newer', updatedAt: at(12) });

    expect(
      newer.updateFrom(snapshotOf({ title: 'Older', updatedAt: at(11) })),
    ).toBe(newer);
    expect(
      newer.updateFrom(snapshotOf({ title: 'Newest', updatedAt: at(13) }))
        .title,
    ).toBe('Newest');
  });

  it('remembers GitHub touching it without saying anything new', () => {
    const touched = opened({ updatedAt: at(12) }).updateFrom(
      snapshotOf({ updatedAt: at(14) }),
    );

    expect(touched.updatedAt).toEqual(at(14));
    expect(touched.hasEvents).toBe(false);
  });

  it('clears when it closed once it opens again', () => {
    const reopened = stored(
      opened().updateFrom(snapshotOf({ state: 'closed', closedAt: at(12) })),
    ).updateFrom(
      snapshotOf({ state: 'open', closedAt: null, updatedAt: at(13) }),
    );

    expect(reopened.state).toBe('open');
    expect(reopened.closedAt).toBeNull();
  });

  it('stays closed when told it is open no later than it closed', () => {
    const closed = stored(
      opened().updateFrom(
        snapshotOf({ state: 'closed', closedAt: at(12), updatedAt: at(12) }),
      ),
    );

    expect(
      closed.updateFrom(snapshotOf({ state: 'open', updatedAt: at(12) })).state,
    ).toBe('closed');
    expect(
      closed.updateFrom(snapshotOf({ state: 'open', updatedAt: null })).state,
    ).toBe('closed');
  });

  describe('reviews', () => {
    it('keeps each review once, by people and bots alike, in the order they arrived', () => {
      const reviewed = opened()
        .recordReview(review(1, 'approved', 9, true))
        .recordReview(review(2, 'approved', 10))
        .recordReview(review(2, 'approved', 10));

      expect(reviewed.reviews).toEqual([
        review(1, 'approved', 9, true),
        review(2, 'approved', 10),
      ]);
      expect(updated(reviewed)?.reviews).toEqual(reviewed.reviews);
    });

    it('says which reviews were dismissed, whichever arrives first', () => {
      const dismissedAfter = opened()
        .recordReview(review(1, 'changes-requested', 9))
        .recordReview(review(2, 'approved', 10))
        .dismissReview(1);
      const dismissedBefore = stored(opened().dismissReview(1)).recordReview(
        review(1, 'changes-requested', 9),
      );

      expect(updated(dismissedAfter)).toMatchObject({ dismissedReviews: [1] });
      expect(updated(dismissedBefore)).toMatchObject({
        reviews: [review(1, 'changes-requested', 9)],
        dismissedReviews: [1],
      });
    });

    it('says nothing new when a review it does not know is dismissed', () => {
      expect(opened().dismissReview(1).hasEvents).toBe(false);
    });
  });

  describe('review comments', () => {
    it('counts each comment a person made once, and stops counting a deleted one', () => {
      const commented = opened()
        .recordComment(comment(1, 'created'))
        .recordComment(comment(1, 'created'))
        .recordComment(comment(2, 'created'))
        .recordComment(comment(3, 'created', { byBot: true }))
        .recordComment(comment(4, 'created', { on: 'conversation' }))
        .recordComment(comment(2, 'deleted'))
        .recordComment(comment(1, 'edited'));

      expect(commented.comments).toEqual([1]);
    });

    it('does not count a deleted comment again when its creation arrives after', () => {
      const deleted = stored(
        opened()
          .recordComment(comment(1, 'created'))
          .recordComment(comment(1, 'deleted')),
      );
      const deletedFirst = stored(
        opened().recordComment(comment(2, 'deleted')),
      );

      expect(deleted.recordComment(comment(1, 'created'))).toBe(deleted);
      expect(deletedFirst.recordComment(comment(2, 'created'))).toBe(
        deletedFirst,
      );
      expect(deletedFirst.comments).toEqual([]);
    });
  });

  describe('readiness for review', () => {
    it('is ready for review when it opened, unless it opened as a draft', () => {
      expect(updated(received())).toMatchObject({ readyForReviewAt: OPENED });
      expect(updated(received({ draft: true }))).toMatchObject({
        readyForReviewAt: null,
      });
    });

    it('becomes ready for review when GitHub marks the draft ready', () => {
      const ready = opened({ draft: true }).updateFrom(
        snapshotOf({ markedReadyAt: at(11), updatedAt: at(11) }),
      );

      expect(ready.readyForReviewAt).toEqual(at(11));
      expect(updated(ready)).toMatchObject({ readyForReviewAt: at(11) });
    });

    it('takes the time GitHub last changed it where it missed the draft being marked ready', () => {
      expect(
        opened({ draft: true }).updateFrom(snapshotOf({ updatedAt: at(12) }))
          .readyForReviewAt,
      ).toEqual(at(12));
    });

    it('was first ready for review even after it turns back into a draft', () => {
      const ready = stored(
        opened({ draft: true }).updateFrom(
          snapshotOf({ markedReadyAt: at(11), updatedAt: at(11) }),
        ),
      );
      const draftAgain = stored(
        ready.updateFrom(snapshotOf({ draft: true, updatedAt: at(12) })),
      );
      const readyAgain = draftAgain.updateFrom(
        snapshotOf({ markedReadyAt: at(13), updatedAt: at(13) }),
      );

      expect(draftAgain.draft).toBe(true);
      expect(draftAgain.readyForReviewAt).toEqual(at(11));
      expect(readyAgain.readyForReviewAt).toEqual(at(11));
    });

    it('keeps each period back as a draft after it was first ready', () => {
      const ready = stored(
        opened({ draft: true }).updateFrom(
          snapshotOf({ markedReadyAt: at(11), updatedAt: at(11) }),
        ),
      );
      const draftAgain = stored(
        ready.updateFrom(
          snapshotOf({ draft: true, markedDraftAt: at(12), updatedAt: at(12) }),
        ),
      );
      const readyAgain = draftAgain.updateFrom(
        snapshotOf({ markedReadyAt: at(13), updatedAt: at(13) }),
      );

      expect(ready.draftPeriods).toEqual([]);
      expect(draftAgain.draftPeriods).toEqual([{ from: at(12), to: null }]);
      expect(readyAgain.draftPeriods).toEqual([{ from: at(12), to: at(13) }]);
      expect(updated(readyAgain)).toMatchObject({
        draftPeriods: [{ from: at(12), to: at(13) }],
      });
      expect(
        stored(readyAgain).updateFrom(snapshotOf({ updatedAt: at(14) }))
          .draftPeriods,
      ).toEqual([{ from: at(12), to: at(13) }]);
    });

    it('opens a period when GitHub turns it back into a draft before the word that it was ready arrives', () => {
      const draftAgain = stored(
        opened({ draft: true }).updateFrom(
          snapshotOf({ draft: true, markedDraftAt: at(12), updatedAt: at(12) }),
        ),
      );
      const lateReady = draftAgain.updateFrom(
        snapshotOf({ markedReadyAt: at(11), updatedAt: at(11) }),
      );

      expect(draftAgain.draftPeriods).toEqual([{ from: at(12), to: null }]);
      expect(lateReady.readyForReviewAt).toEqual(at(11));
      expect(lateReady.draft).toBe(true);
      expect(lateReady.draftPeriods).toEqual([{ from: at(12), to: null }]);
    });

    it('opens a period when the first it receives is GitHub turning it back into a draft', () => {
      const draft = received({
        draft: true,
        markedDraftAt: at(12),
        updatedAt: at(12),
      });

      expect(draft.readyForReviewAt).toBeNull();
      expect(draft.draftPeriods).toEqual([{ from: at(12), to: null }]);
      expect(
        stored(draft).updateFrom(
          snapshotOf({ markedReadyAt: at(14), updatedAt: at(14) }),
        ).draftPeriods,
      ).toEqual([{ from: at(12), to: at(14) }]);
    });

    it('closes a period at the time GitHub last changed it where it missed the draft being marked ready', () => {
      const draftAgain = stored(
        opened().updateFrom(
          snapshotOf({ draft: true, markedDraftAt: at(10), updatedAt: at(10) }),
        ),
      );

      expect(
        draftAgain.updateFrom(snapshotOf({ updatedAt: at(13) })).draftPeriods,
      ).toEqual([{ from: at(10), to: at(13) }]);
    });

    it('keeps one period open however often it learns the pull request is a draft', () => {
      const draftAgain = stored(
        opened().updateFrom(
          snapshotOf({ draft: true, markedDraftAt: at(10), updatedAt: at(10) }),
        ),
      );

      expect(
        draftAgain.updateFrom(
          snapshotOf({ draft: true, markedDraftAt: at(10), updatedAt: at(10) }),
        ),
      ).toBe(draftAgain);
      expect(
        draftAgain.updateFrom(snapshotOf({ draft: true, updatedAt: at(11) }))
          .draftPeriods,
      ).toEqual([{ from: at(10), to: null }]);
    });

    it('misses a period whose turn back into a draft arrives after a later word', () => {
      const later = stored(
        opened().updateFrom(snapshotOf({ updatedAt: at(13) })),
      );

      expect(
        later.updateFrom(
          snapshotOf({ draft: true, markedDraftAt: at(10), updatedAt: at(10) }),
        ),
      ).toBe(later);
    });

    it('keeps its periods when an earlier mark of ready arrives late', () => {
      const guessed = stored(
        opened({ draft: true }).updateFrom(snapshotOf({ updatedAt: at(10) })),
      );
      const drafted = stored(
        guessed.updateFrom(
          snapshotOf({ draft: true, markedDraftAt: at(12), updatedAt: at(12) }),
        ),
      );
      const marked = drafted.updateFrom(
        snapshotOf({ markedReadyAt: at(9), updatedAt: at(9) }),
      );

      expect(marked.readyForReviewAt).toEqual(at(9));
      expect(marked.draftPeriods).toEqual([{ from: at(12), to: null }]);
    });

    it('takes the time GitHub marked the draft ready even when it arrives after a later change', () => {
      const guessed = stored(
        opened({ draft: true }).updateFrom(snapshotOf({ updatedAt: at(12) })),
      );
      const marked = guessed.updateFrom(
        snapshotOf({ markedReadyAt: at(11), updatedAt: at(11) }),
      );

      expect(guessed.readyForReviewAt).toEqual(at(12));
      expect(marked.readyForReviewAt).toEqual(at(11));
      expect(marked.updatedAt).toEqual(at(12));
      expect(updated(marked)).toMatchObject({ readyForReviewAt: at(11) });
    });
  });

  describe('bot activity', () => {
    const bot = { byBot: true } as const;
    const botComment = (
      id: number,
      on: 'line' | 'conversation',
      opensThread: boolean,
      login = 'coderabbitai[bot]',
    ) => BotComment.of({ id, on, login, opensThread, deleted: false });

    it('keeps each comment a bot made, and whether it opened a thread', () => {
      const busy = opened()
        .recordReview(review(1, 'commented', 9, true))
        .recordReview(review(2, 'approved', 10, true, 'renovate[bot]'))
        .recordReview(review(3, 'approved', 11))
        .recordComment(comment(10, 'created', bot))
        .recordComment(comment(11, 'created', { ...bot, inReplyToId: 10 }))
        .recordComment(comment(12, 'created', { ...bot, on: 'conversation' }))
        .recordComment(
          comment(13, 'created', { ...bot, login: 'renovate[bot]' }),
        );

      expect(updated(busy)?.botComments).toEqual([
        botComment(10, 'line', true),
        botComment(11, 'line', false),
        botComment(12, 'conversation', false),
        botComment(13, 'line', true, 'renovate[bot]'),
      ]);
      expect(busy.comments).toEqual([]);
    });

    it('keeps a bot comment once, and keeps it deleted however late its creation arrives', () => {
      const commented = stored(
        opened()
          .recordComment(comment(10, 'created', bot))
          .recordComment(comment(10, 'created', bot))
          .recordComment(comment(10, 'edited', bot))
          .recordComment(
            comment(10, 'created', { ...bot, on: 'conversation' }),
          ),
      );
      const deleting = commented.recordComment(comment(10, 'deleted', bot));
      const deleted = stored(deleting);
      const deletedFirst = stored(
        opened().recordComment(comment(11, 'deleted', bot)),
      );

      expect(commented.botComments).toHaveLength(2);
      expect(updated(deleting)?.botComments).toContainEqual(
        BotComment.of({
          id: 10,
          on: 'line',
          login: 'coderabbitai[bot]',
          opensThread: true,
          deleted: true,
        }),
      );
      expect(deleted.botComments.filter((each) => !each.deleted)).toHaveLength(
        1,
      );
      expect(deleted.recordComment(comment(10, 'created', bot))).toBe(deleted);
      expect(deletedFirst.hasEvents).toBe(false);
      expect(deletedFirst.recordComment(comment(11, 'created', bot))).toBe(
        deletedFirst,
      );
    });

    it('keeps the threads a bot opened and whether each is resolved now', () => {
      const threaded = opened()
        .recordComment(comment(10, 'created', bot))
        .resolveThread(thread('PRRT_1', true, { firstCommentId: 10 }))
        .resolveThread(thread('PRRT_2', true))
        .resolveThread(thread('PRRT_2', false))
        .resolveThread(thread('PRRT_3', true));

      expect(updated(threaded)?.threads).toEqual([
        thread('PRRT_1', true, { firstCommentId: 10 }),
        thread('PRRT_2', false),
        thread('PRRT_3', true),
      ]);
    });

    it('takes a thread resolved again as nothing new, and leaves a person’s thread out', () => {
      const resolved = stored(opened().resolveThread(thread('PRRT_1', true)));
      const byPerson = opened().resolveThread(
        thread('PRRT_2', true, { login: 'grace', byBot: false }),
      );

      expect(resolved.resolveThread(thread('PRRT_1', true))).toBe(resolved);
      expect(byPerson.threads).toHaveLength(0);
      expect(byPerson.hasEvents).toBe(false);
    });
  });

  describe('reverts', () => {
    const revert = (over: Partial<PullRequestSnapshot> = {}) =>
      opened({
        url: PullRequestUrl.of('https://github.com/acme/api/pull/9'),
        number: 9,
        title: 'Revert "Retry failed uploads"',
        body: 'Reverts acme/api#7',
        ...over,
      });

    it('says which pull request a revert reverts once it merges', () => {
      const merged = revert().updateFrom(
        snapshotOf({
          url: PullRequestUrl.of('https://github.com/acme/api/pull/9'),
          number: 9,
          title: 'Revert "Retry failed uploads"',
          body: 'Reverts acme/api#7',
          state: 'merged',
          closedAt: MERGED,
        }),
      );

      expect(merged.pullEvents()).toContainEqual(
        expect.objectContaining({
          kind: 'pull-request.revert-merged',
          pullRequest: PullRequestUrl.of('https://github.com/acme/api/pull/9'),
          reverts: { kind: 'number', number: 7 },
        }),
      );
    });

    it('says nothing of a revert that has not merged', () => {
      expect(
        kinds(received({ title: 'Revert "Retry failed uploads"' })),
      ).toEqual(['pull-request.updated']);
    });

    it('marks a merged pull request reverted, once', () => {
      const merged = opened({ state: 'merged', closedAt: MERGED });
      const by = PullRequestUrl.of('https://github.com/acme/api/pull/9');
      const reverted = merged.recordRevert(by);

      expect(reverted.revertedBy).toEqual(by);
      expect(updated(reverted)).toMatchObject({ revertedBy: by });
      expect(stored(reverted).recordRevert(by).hasEvents).toBe(false);
    });

    it('marks no open pull request reverted, nor one reverting itself', () => {
      const original = opened();

      expect(
        original.recordRevert(
          PullRequestUrl.of('https://github.com/acme/api/pull/9'),
        ),
      ).toBe(original);

      const merged = opened({ state: 'merged', closedAt: MERGED });
      expect(merged.recordRevert(URL_7)).toBe(merged);
    });
  });

  describe('retention', () => {
    it('can be purged 180 days after it closed, and not before', () => {
      const closed = opened({ state: 'closed', closedAt: MERGED });

      expect(
        closed.isPastRetention(new Date(MERGED.getTime() + 180 * DAY + 1)),
      ).toBe(true);
      expect(
        closed.isPastRetention(new Date(MERGED.getTime() + 179 * DAY)),
      ).toBe(false);
    });

    it('can be purged once open and untouched for 180 days, and not before', () => {
      const idle = opened({ updatedAt: MERGED });

      expect(
        idle.isPastRetention(new Date(MERGED.getTime() + 180 * DAY + 1)),
      ).toBe(true);
      expect(idle.isPastRetention(new Date(MERGED.getTime() + 179 * DAY))).toBe(
        false,
      );
    });

    it('does not record what is already past retention', () => {
      const long = new Date(NOW.getTime() - 181 * DAY);

      expect(
        PullRequest.fromWebhook(
          WORKSPACE,
          snapshotOf({ state: 'merged', closedAt: long, openedAt: long }),
          NOW,
        ),
      ).toBeNull();
      expect(
        PullRequest.fromWebhook(
          WORKSPACE,
          snapshotOf({ openedAt: long, updatedAt: long }),
          NOW,
        ),
      ).toBeNull();
      expect(
        PullRequest.fromWebhook(
          WORKSPACE,
          snapshotOf({ openedAt: long, updatedAt: NOW }),
          NOW,
        ),
      ).not.toBeNull();
    });

    it('says it was purged, and when GitHub last changed it', () => {
      const purged = opened({
        state: 'closed',
        closedAt: MERGED,
        updatedAt: new Date('2026-09-22T09:00:00Z'),
      }).purge();

      expect(purged.pullEvents()).toEqual([
        expect.objectContaining({
          kind: 'pull-request.purged',
          pullRequest: URL_7,
          updatedAt: new Date('2026-09-22T09:00:00Z'),
        }),
      ]);
    });
  });

  describe('what it says happened on GitHub', () => {
    const DETAILS = {
      url: 'https://github.com/acme/api/pull/7#discussion_r1',
      path: 'src/a.ts',
      subject: 'file' as const,
      body: 'Why not a constant?',
      writtenAt: at(1),
    };

    it('says it was closed, and how, each time GitHub says so', () => {
      const closing = {
        repository: Repository.of('acme/api'),
        gitHubId: 707,
        merge: { commit: 'c'.repeat(40) },
        closedAt: at(2),
      };
      const closed = opened().closedBy(closing);
      const said = closed.pullEvents();

      expect(said).toEqual([
        new PullRequestClosed(
          WORKSPACE,
          closed.url,
          Repository.of('acme/api'),
          707,
          { commit: 'c'.repeat(40) },
          at(2),
        ),
      ]);
      expect(kinds(stored(closed).closedBy(closing))).toEqual([
        'pull-request.closed',
      ]);
    });

    it('says it was reopened', () => {
      expect(
        kinds(
          opened().reopenedBy({
            repository: Repository.of('acme/api'),
            gitHubId: 707,
            reopenedAt: at(3),
          }),
        ),
      ).toEqual(['pull-request.reopened']);
    });

    it('takes a review once, however often GitHub sends it', () => {
      const reviewed = opened().recordReview(review(1, 'approved', 1));

      expect(kinds(reviewed)).toEqual(['pull-request.updated']);
      const again = stored(reviewed);
      expect(again.recordReview(review(1, 'approved', 1))).toBe(again);
    });

    it('says a review comment was received, once for its creation and again for each edit', () => {
      const created = opened().recordComment(
        comment(1, 'created', { details: DETAILS }),
      );

      const said = created.pullEvents();

      expect(said[said.length - 1]).toEqual(
        new ReviewCommentReceived(WORKSPACE, 'created', created.url, {
          id: 1,
          inReplyToId: null,
          login: 'grace',
          ...DETAILS,
        }),
      );
      expect(
        kinds(
          stored(created).recordComment(
            comment(1, 'created', { details: DETAILS }),
          ),
        ),
      ).toEqual([]);
      expect(
        kinds(
          stored(created).recordComment(
            comment(1, 'edited', { details: DETAILS }),
          ),
        ),
      ).toEqual(['pull-request.review-comment-received']);
    });

    it('says nothing for a conversation comment', () => {
      expect(
        kinds(
          opened().recordComment(comment(1, 'created', { on: 'conversation' })),
        ),
      ).toEqual([]);
    });
  });
});
