import {
  type HeardReview,
  PullRequest,
  type PullRequestFacts,
} from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestRecorded } from '@github/domain/events/pull-request-recorded.event';
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

const factsOf = (over: Partial<PullRequestFacts> = {}): PullRequestFacts => ({
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
  state: 'open',
  closedAt: null,
  updatedAt: null,
  ...over,
});

const at = (hour: number) =>
  new Date(`2026-09-20T${String(hour).padStart(2, '0')}:00:00Z`);

const review = (
  id: number,
  state: HeardReview['state'],
  hour: number,
  byBot = false,
): HeardReview => ({ id, state, byBot, at: at(hour) });

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
    state: pullRequest.state,
    closedAt: pullRequest.closedAt,
    updatedAt: pullRequest.updatedAt,
    reverts: pullRequest.reverts,
    reviews: pullRequest.reviews,
    dismissedReviews: pullRequest.dismissedReviews,
    comments: pullRequest.comments,
    deletedComments: pullRequest.deletedComments,
    revertedBy: pullRequest.revertedBy,
    version: pullRequest.version + 1,
  });

const heard = (over: Partial<PullRequestFacts> = {}) => {
  const first = PullRequest.heard(WORKSPACE, factsOf(over), NOW);

  if (!first) {
    throw new Error('Expected the pull request to be recorded');
  }

  return first;
};

const opened = (over: Partial<PullRequestFacts> = {}) => stored(heard(over));

const kinds = (pullRequest: PullRequest) =>
  pullRequest.pullEvents().map((each) => each.kind);

const recorded = (pullRequest: PullRequest) =>
  (
    pullRequest
      .pullEvents()
      .find((each) => each.kind === 'pull-request.recorded') as
      | PullRequestRecorded
      | undefined
  )?.recorded;

describe('PullRequest', () => {
  it('records what it heard of a pull request, whether or not a task owns it', () => {
    expect(recorded(heard())).toMatchObject({
      pullRequest: URL_7.value,
      repository: 'acme/api',
      number: 7,
      author: 'ada',
      additions: 40,
      state: 'open',
      reviewRounds: 0,
      reviewComments: 0,
      isRevert: false,
      version: 1,
    });
  });

  it('records each change once, at the version it will be stored as', () => {
    const changed = opened()
      .reviewedBy(review(1, 'commented', 9))
      .reviewedBy(review(2, 'approved', 10));

    const events = changed.pullEvents();

    expect(events.map((each) => each.kind)).toEqual(['pull-request.recorded']);
    expect((events[0] as PullRequestRecorded).recorded).toMatchObject({
      reviews: 2,
      version: 2,
    });
  });

  it('changes nothing where it hears what it already holds', () => {
    const held = opened();
    const reviewed = stored(held.reviewedBy(review(1, 'approved', 9)));

    expect(held.described(factsOf())).toBe(held);
    expect(reviewed.reviewedBy(review(1, 'approved', 9))).toBe(reviewed);
  });

  it('keeps a merged pull request merged, whatever it hears after', () => {
    const merged = opened().described(
      factsOf({ state: 'merged', closedAt: MERGED }),
    );
    const after = stored(merged).described(
      factsOf({ state: 'closed', closedAt: at(23), title: 'Renamed' }),
    );

    expect(after.state).toBe('merged');
    expect(after.closedAt).toEqual(MERGED);
    expect(after.title).toBe('Renamed');
  });

  it('keeps the size it knows where it later hears none', () => {
    expect(
      opened().described(factsOf({ size: null, title: 'New' })).size,
    ).toEqual({ additions: 40, deletions: 3, changedFiles: 2 });
  });

  it('keeps its repository in lower case, however GitHub spells it', () => {
    expect(
      opened({ repository: Repository.of('Acme/API') }).repository,
    ).toEqual(Repository.of('acme/api'));
  });

  it('ignores what GitHub said before what it already heard, however late it arrives', () => {
    const newer = opened({ title: 'Newer', updatedAt: at(12) });

    expect(
      newer.described(factsOf({ title: 'Older', updatedAt: at(11) })),
    ).toBe(newer);
    expect(
      newer.described(factsOf({ title: 'Newest', updatedAt: at(13) })).title,
    ).toBe('Newest');
  });

  it('remembers GitHub touching it without saying anything new', () => {
    const touched = opened({ updatedAt: at(12) }).described(
      factsOf({ updatedAt: at(14) }),
    );

    expect(touched.updatedAt).toEqual(at(14));
    expect(touched.hasEvents).toBe(false);
  });

  it('forgets when it closed once it opens again', () => {
    const reopened = stored(
      opened().described(factsOf({ state: 'closed', closedAt: at(12) })),
    ).described(factsOf({ state: 'open', closedAt: null, updatedAt: at(13) }));

    expect(reopened.state).toBe('open');
    expect(reopened.closedAt).toBeNull();
  });

  it('stays closed when told it is open no later than it closed', () => {
    const closed = stored(
      opened().described(
        factsOf({ state: 'closed', closedAt: at(12), updatedAt: at(12) }),
      ),
    );

    expect(
      closed.described(factsOf({ state: 'open', updatedAt: at(12) })).state,
    ).toBe('closed');
    expect(
      closed.described(factsOf({ state: 'open', updatedAt: null })).state,
    ).toBe('closed');
  });

  describe('review rounds', () => {
    it('counts no round before anyone reviews', () => {
      expect(opened().reviewRounds).toBe(0);
    });

    it('counts each approval or request for changes by a person as a round', () => {
      const reviewed = opened()
        .reviewedBy(review(1, 'changes-requested', 9))
        .reviewedBy(review(2, 'commented', 10))
        .reviewedBy(review(3, 'approved', 11));

      expect(reviewed.reviewRounds).toBe(2);
    });

    it('counts comments after the last verdict as a round still open', () => {
      const reviewed = opened()
        .reviewedBy(review(1, 'changes-requested', 9))
        .reviewedBy(review(2, 'commented', 10));

      expect(reviewed.reviewRounds).toBe(2);
    });

    it('counts comments with no verdict as one round', () => {
      const reviewed = opened()
        .reviewedBy(review(1, 'commented', 9))
        .reviewedBy(review(2, 'commented', 10));

      expect(reviewed.reviewRounds).toBe(1);
    });

    it('leaves out what bots said, and hears each review once', () => {
      const reviewed = opened()
        .reviewedBy(review(1, 'approved', 9, true))
        .reviewedBy(review(2, 'approved', 10))
        .reviewedBy(review(2, 'approved', 10));

      expect(reviewed.reviewRounds).toBe(1);
      expect(reviewed.firstReviewAt).toEqual(at(10));
    });

    it('leaves out a dismissed review, whichever is heard first', () => {
      const dismissedAfter = opened()
        .reviewedBy(review(1, 'changes-requested', 9))
        .reviewedBy(review(2, 'approved', 10))
        .reviewDismissed(1);
      const dismissedBefore = stored(opened().reviewDismissed(1)).reviewedBy(
        review(1, 'changes-requested', 9),
      );

      expect(dismissedAfter.reviewRounds).toBe(1);
      expect(dismissedAfter.firstReviewAt).toEqual(at(10));
      expect(recorded(dismissedAfter)).toMatchObject({ reviews: 1 });
      expect(dismissedBefore.reviewRounds).toBe(0);
      expect(dismissedBefore.firstReviewAt).toBeNull();
      expect(dismissedBefore.hasEvents).toBe(false);
    });

    it('takes the earliest review by a person as the first, however late it is heard', () => {
      const reviewed = opened()
        .reviewedBy(review(1, 'approved', 11))
        .reviewedBy(review(2, 'commented', 9));

      expect(reviewed.firstReviewAt).toEqual(at(9));
    });
  });

  describe('review comments', () => {
    it('counts each comment a person made once, and forgets a deleted one', () => {
      const commented = opened()
        .commentedOn({ id: 1, action: 'created', byBot: false })
        .commentedOn({ id: 1, action: 'created', byBot: false })
        .commentedOn({ id: 2, action: 'created', byBot: false })
        .commentedOn({ id: 3, action: 'created', byBot: true })
        .commentedOn({ id: 2, action: 'deleted', byBot: false })
        .commentedOn({ id: 1, action: 'edited', byBot: false });

      expect(commented.comments).toEqual([1]);
    });

    it('does not count a deleted comment again when its creation is heard after', () => {
      const deleted = stored(
        opened()
          .commentedOn({ id: 1, action: 'created', byBot: false })
          .commentedOn({ id: 1, action: 'deleted', byBot: false }),
      );
      const deletedFirst = stored(
        opened().commentedOn({ id: 2, action: 'deleted', byBot: false }),
      );

      expect(
        deleted.commentedOn({ id: 1, action: 'created', byBot: false }),
      ).toBe(deleted);
      expect(
        deletedFirst.commentedOn({ id: 2, action: 'created', byBot: false }),
      ).toBe(deletedFirst);
      expect(deletedFirst.comments).toEqual([]);
    });
  });

  describe('reverts', () => {
    const revert = (over: Partial<PullRequestFacts> = {}) =>
      opened({
        url: PullRequestUrl.of('https://github.com/acme/api/pull/9'),
        number: 9,
        title: 'Revert "Retry failed uploads"',
        body: 'Reverts acme/api#7',
        ...over,
      });

    it('says which pull request a revert reverts once it merges', () => {
      const merged = revert().described(
        factsOf({
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
          pullRequest: 'https://github.com/acme/api/pull/9',
          reverts: { kind: 'number', number: 7 },
        }),
      );
    });

    it('says nothing of a revert that has not merged', () => {
      expect(kinds(heard({ title: 'Revert "Retry failed uploads"' }))).toEqual([
        'pull-request.recorded',
      ]);
    });

    it('marks a merged pull request reverted, once', () => {
      const merged = opened({ state: 'merged', closedAt: MERGED });
      const by = PullRequestUrl.of('https://github.com/acme/api/pull/9');
      const reverted = merged.revertedWith(by);

      expect(reverted.revertedBy).toEqual(by);
      expect(recorded(reverted)).toMatchObject({ revertedBy: by.value });
      expect(stored(reverted).revertedWith(by).hasEvents).toBe(false);
    });

    it('marks no open pull request reverted, nor one reverting itself', () => {
      const held = opened();

      expect(
        held.revertedWith(
          PullRequestUrl.of('https://github.com/acme/api/pull/9'),
        ),
      ).toBe(held);

      const merged = opened({ state: 'merged', closedAt: MERGED });
      expect(merged.revertedWith(URL_7)).toBe(merged);
    });
  });

  describe('retention', () => {
    it('can be forgotten 180 days after it closed, and not before', () => {
      const closed = opened({ state: 'closed', closedAt: MERGED });

      expect(
        closed.forgettableAt(new Date(MERGED.getTime() + 180 * DAY + 1)),
      ).toBe(true);
      expect(closed.forgettableAt(new Date(MERGED.getTime() + 179 * DAY))).toBe(
        false,
      );
    });

    it('can be forgotten once open and untouched for 180 days, and not before', () => {
      const idle = opened({ updatedAt: MERGED });

      expect(
        idle.forgettableAt(new Date(MERGED.getTime() + 180 * DAY + 1)),
      ).toBe(true);
      expect(idle.forgettableAt(new Date(MERGED.getTime() + 179 * DAY))).toBe(
        false,
      );
    });

    it('refuses to record what is already past retention', () => {
      const long = new Date(NOW.getTime() - 181 * DAY);

      expect(
        PullRequest.heard(
          WORKSPACE,
          factsOf({ state: 'merged', closedAt: long, openedAt: long }),
          NOW,
        ),
      ).toBeNull();
      expect(
        PullRequest.heard(
          WORKSPACE,
          factsOf({ openedAt: long, updatedAt: long }),
          NOW,
        ),
      ).toBeNull();
      expect(
        PullRequest.heard(
          WORKSPACE,
          factsOf({ openedAt: long, updatedAt: NOW }),
          NOW,
        ),
      ).not.toBeNull();
    });

    it('says it was forgotten, and when GitHub last changed it', () => {
      const forgotten = opened({
        state: 'closed',
        closedAt: MERGED,
        updatedAt: new Date('2026-09-22T09:00:00Z'),
      }).forgotten();

      expect(forgotten.pullEvents()).toEqual([
        expect.objectContaining({
          kind: 'pull-request.forgotten',
          pullRequest: URL_7.value,
          updatedAt: new Date('2026-09-22T09:00:00Z'),
        }),
      ]);
    });
  });
});
