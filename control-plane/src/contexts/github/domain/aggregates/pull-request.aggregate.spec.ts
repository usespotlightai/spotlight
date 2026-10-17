import {
  type HeardComment,
  type HeardReview,
  PullRequest,
  type PullRequestFacts,
} from '@github/domain/aggregates/pull-request.aggregate';
import type { PullRequestRecorded } from '@github/domain/events/pull-request-recorded.event';
import type { HeardThread } from '@github/domain/value-objects/bot-activity.vo';
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
  state: HeardReview['state'],
  hour: number,
  byBot = false,
  login = byBot ? 'coderabbitai[bot]' : 'grace',
): HeardReview => ({ id, state, login, byBot, at: at(hour) });

const comment = (
  id: number,
  action: HeardComment['action'],
  over: Partial<HeardComment> = {},
): HeardComment => ({
  id,
  on: 'line',
  action,
  login: over.byBot ? 'coderabbitai[bot]' : 'grace',
  answers: null,
  byBot: false,
  ...over,
});

const thread = (
  id: string,
  resolved: boolean,
  over: Partial<HeardThread> = {},
): HeardThread => ({
  id,
  opener: null,
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
    draftSpells: pullRequest.draftSpells,
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
      .recordReview(review(1, 'commented', 9))
      .recordReview(review(2, 'approved', 10));

    const events = changed.pullEvents();

    expect(events.map((each) => each.kind)).toEqual(['pull-request.recorded']);
    expect((events[0] as PullRequestRecorded).recorded).toMatchObject({
      reviews: 2,
      version: 2,
    });
  });

  it('changes nothing where it hears what it already holds', () => {
    const held = opened();
    const reviewed = stored(held.recordReview(review(1, 'approved', 9)));

    expect(held.describe(factsOf())).toBe(held);
    expect(reviewed.recordReview(review(1, 'approved', 9))).toBe(reviewed);
  });

  it('keeps a merged pull request merged, whatever it hears after', () => {
    const merged = opened().describe(
      factsOf({ state: 'merged', closedAt: MERGED }),
    );
    const after = stored(merged).describe(
      factsOf({ state: 'closed', closedAt: at(23), title: 'Renamed' }),
    );

    expect(after.state).toBe('merged');
    expect(after.closedAt).toEqual(MERGED);
    expect(after.title).toBe('Renamed');
  });

  it('keeps the size it knows where it later hears none', () => {
    expect(
      opened().describe(factsOf({ size: null, title: 'New' })).size,
    ).toEqual({ additions: 40, deletions: 3, changedFiles: 2 });
  });

  it('keeps its repository in lower case, however GitHub spells it', () => {
    expect(
      opened({ repository: Repository.of('Acme/API') }).repository,
    ).toEqual(Repository.of('acme/api'));
  });

  it('ignores what GitHub said before what it already heard, however late it arrives', () => {
    const newer = opened({ title: 'Newer', updatedAt: at(12) });

    expect(newer.describe(factsOf({ title: 'Older', updatedAt: at(11) }))).toBe(
      newer,
    );
    expect(
      newer.describe(factsOf({ title: 'Newest', updatedAt: at(13) })).title,
    ).toBe('Newest');
  });

  it('remembers GitHub touching it without saying anything new', () => {
    const touched = opened({ updatedAt: at(12) }).describe(
      factsOf({ updatedAt: at(14) }),
    );

    expect(touched.updatedAt).toEqual(at(14));
    expect(touched.hasEvents).toBe(false);
  });

  it('forgets when it closed once it opens again', () => {
    const reopened = stored(
      opened().describe(factsOf({ state: 'closed', closedAt: at(12) })),
    ).describe(factsOf({ state: 'open', closedAt: null, updatedAt: at(13) }));

    expect(reopened.state).toBe('open');
    expect(reopened.closedAt).toBeNull();
  });

  it('stays closed when told it is open no later than it closed', () => {
    const closed = stored(
      opened().describe(
        factsOf({ state: 'closed', closedAt: at(12), updatedAt: at(12) }),
      ),
    );

    expect(
      closed.describe(factsOf({ state: 'open', updatedAt: at(12) })).state,
    ).toBe('closed');
    expect(
      closed.describe(factsOf({ state: 'open', updatedAt: null })).state,
    ).toBe('closed');
  });

  describe('review rounds', () => {
    it('counts no round before anyone reviews', () => {
      expect(opened().reviewRounds).toBe(0);
    });

    it('counts each approval or request for changes by a person as a round', () => {
      const reviewed = opened()
        .recordReview(review(1, 'changes-requested', 9))
        .recordReview(review(2, 'commented', 10))
        .recordReview(review(3, 'approved', 11));

      expect(reviewed.reviewRounds).toBe(2);
    });

    it('counts comments after the last verdict as a round still open', () => {
      const reviewed = opened()
        .recordReview(review(1, 'changes-requested', 9))
        .recordReview(review(2, 'commented', 10));

      expect(reviewed.reviewRounds).toBe(2);
    });

    it('counts comments with no verdict as one round', () => {
      const reviewed = opened()
        .recordReview(review(1, 'commented', 9))
        .recordReview(review(2, 'commented', 10));

      expect(reviewed.reviewRounds).toBe(1);
    });

    it('leaves out what bots said, and hears each review once', () => {
      const reviewed = opened()
        .recordReview(review(1, 'approved', 9, true))
        .recordReview(review(2, 'approved', 10))
        .recordReview(review(2, 'approved', 10));

      expect(reviewed.reviewRounds).toBe(1);
      expect(reviewed.firstReviewAt).toEqual(at(10));
    });

    it('leaves out a dismissed review, whichever is heard first', () => {
      const dismissedAfter = opened()
        .recordReview(review(1, 'changes-requested', 9))
        .recordReview(review(2, 'approved', 10))
        .dismissReview(1);
      const dismissedBefore = stored(opened().dismissReview(1)).recordReview(
        review(1, 'changes-requested', 9),
      );

      expect(dismissedAfter.reviewRounds).toBe(1);
      expect(dismissedAfter.firstReviewAt).toEqual(at(10));
      expect(recorded(dismissedAfter)).toMatchObject({ reviews: 1 });
      expect(dismissedBefore.reviewRounds).toBe(0);
      expect(dismissedBefore.firstReviewAt).toBeNull();
      expect(recorded(dismissedBefore)).toMatchObject({
        reviews: 0,
        firstUnblockingReviewAt: at(9),
      });
    });

    it('takes the earliest review by a person as the first, however late it is heard', () => {
      const reviewed = opened()
        .recordReview(review(1, 'approved', 11))
        .recordReview(review(2, 'commented', 9));

      expect(reviewed.firstReviewAt).toEqual(at(9));
    });
  });

  describe('review comments', () => {
    it('counts each comment a person made once, and forgets a deleted one', () => {
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

    it('does not count a deleted comment again when its creation is heard after', () => {
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
      expect(recorded(heard())).toMatchObject({ readyForReviewAt: OPENED });
      expect(recorded(heard({ draft: true }))).toMatchObject({
        readyForReviewAt: null,
      });
    });

    it('becomes ready for review when GitHub marks the draft ready', () => {
      const ready = opened({ draft: true }).describe(
        factsOf({ markedReadyAt: at(11), updatedAt: at(11) }),
      );

      expect(ready.readyForReviewAt).toEqual(at(11));
      expect(recorded(ready)).toMatchObject({ readyForReviewAt: at(11) });
    });

    it('takes the time GitHub last changed it where it missed the draft being marked ready', () => {
      expect(
        opened({ draft: true }).describe(factsOf({ updatedAt: at(12) }))
          .readyForReviewAt,
      ).toEqual(at(12));
    });

    it('was first ready for review even after it turns back into a draft', () => {
      const ready = stored(
        opened({ draft: true }).describe(
          factsOf({ markedReadyAt: at(11), updatedAt: at(11) }),
        ),
      );
      const draftAgain = stored(
        ready.describe(factsOf({ draft: true, updatedAt: at(12) })),
      );
      const readyAgain = draftAgain.describe(
        factsOf({ markedReadyAt: at(13), updatedAt: at(13) }),
      );

      expect(draftAgain.draft).toBe(true);
      expect(draftAgain.readyForReviewAt).toEqual(at(11));
      expect(readyAgain.readyForReviewAt).toEqual(at(11));
    });

    it('keeps each spell back as a draft after it was first ready', () => {
      const ready = stored(
        opened({ draft: true }).describe(
          factsOf({ markedReadyAt: at(11), updatedAt: at(11) }),
        ),
      );
      const draftAgain = stored(
        ready.describe(
          factsOf({ draft: true, markedDraftAt: at(12), updatedAt: at(12) }),
        ),
      );
      const readyAgain = draftAgain.describe(
        factsOf({ markedReadyAt: at(13), updatedAt: at(13) }),
      );

      expect(ready.draftSpells).toEqual([]);
      expect(draftAgain.draftSpells).toEqual([{ from: at(12), to: null }]);
      expect(readyAgain.draftSpells).toEqual([{ from: at(12), to: at(13) }]);
      expect(recorded(readyAgain)).toMatchObject({
        draftSpells: [{ from: at(12), to: at(13) }],
      });
      expect(
        stored(readyAgain).describe(factsOf({ updatedAt: at(14) })).draftSpells,
      ).toEqual([{ from: at(12), to: at(13) }]);
    });

    it('opens a spell when GitHub turns it back into a draft before the word that it was ready arrives', () => {
      const draftAgain = stored(
        opened({ draft: true }).describe(
          factsOf({ draft: true, markedDraftAt: at(12), updatedAt: at(12) }),
        ),
      );
      const lateReady = draftAgain.describe(
        factsOf({ markedReadyAt: at(11), updatedAt: at(11) }),
      );

      expect(draftAgain.draftSpells).toEqual([{ from: at(12), to: null }]);
      expect(lateReady.readyForReviewAt).toEqual(at(11));
      expect(lateReady.draft).toBe(true);
      expect(lateReady.draftSpells).toEqual([{ from: at(12), to: null }]);
    });

    it('opens a spell when the first it hears is GitHub turning it back into a draft', () => {
      const draft = heard({
        draft: true,
        markedDraftAt: at(12),
        updatedAt: at(12),
      });

      expect(draft.readyForReviewAt).toBeNull();
      expect(draft.draftSpells).toEqual([{ from: at(12), to: null }]);
      expect(
        stored(draft).describe(
          factsOf({ markedReadyAt: at(14), updatedAt: at(14) }),
        ).draftSpells,
      ).toEqual([{ from: at(12), to: at(14) }]);
    });

    it('closes a spell at the time GitHub last changed it where it missed the draft being marked ready', () => {
      const draftAgain = stored(
        opened().describe(
          factsOf({ draft: true, markedDraftAt: at(10), updatedAt: at(10) }),
        ),
      );

      expect(
        draftAgain.describe(factsOf({ updatedAt: at(13) })).draftSpells,
      ).toEqual([{ from: at(10), to: at(13) }]);
    });

    it('keeps one spell open however often it hears the pull request is a draft', () => {
      const draftAgain = stored(
        opened().describe(
          factsOf({ draft: true, markedDraftAt: at(10), updatedAt: at(10) }),
        ),
      );

      expect(
        draftAgain.describe(
          factsOf({ draft: true, markedDraftAt: at(10), updatedAt: at(10) }),
        ),
      ).toBe(draftAgain);
      expect(
        draftAgain.describe(factsOf({ draft: true, updatedAt: at(11) }))
          .draftSpells,
      ).toEqual([{ from: at(10), to: null }]);
    });

    it('misses a spell whose turn back into a draft arrives after a later word', () => {
      const later = stored(opened().describe(factsOf({ updatedAt: at(13) })));

      expect(
        later.describe(
          factsOf({ draft: true, markedDraftAt: at(10), updatedAt: at(10) }),
        ),
      ).toBe(later);
    });

    it('keeps its spells when an earlier mark of ready arrives late', () => {
      const guessed = stored(
        opened({ draft: true }).describe(factsOf({ updatedAt: at(10) })),
      );
      const drafted = stored(
        guessed.describe(
          factsOf({ draft: true, markedDraftAt: at(12), updatedAt: at(12) }),
        ),
      );
      const marked = drafted.describe(
        factsOf({ markedReadyAt: at(9), updatedAt: at(9) }),
      );

      expect(marked.readyForReviewAt).toEqual(at(9));
      expect(marked.draftSpells).toEqual([{ from: at(12), to: null }]);
    });

    it('takes the time GitHub marked the draft ready even when it arrives after a later change', () => {
      const guessed = stored(
        opened({ draft: true }).describe(factsOf({ updatedAt: at(12) })),
      );
      const marked = guessed.describe(
        factsOf({ markedReadyAt: at(11), updatedAt: at(11) }),
      );

      expect(guessed.readyForReviewAt).toEqual(at(12));
      expect(marked.readyForReviewAt).toEqual(at(11));
      expect(marked.updatedAt).toEqual(at(12));
      expect(recorded(marked)).toMatchObject({ readyForReviewAt: at(11) });
    });
  });

  describe('review times', () => {
    it('is first unblocked by the earliest review of anyone but its author, bots and dismissed reviews included', () => {
      const reviewed = opened()
        .recordReview(review(1, 'commented', 8, false, 'ada'))
        .recordReview(review(2, 'commented', 9, true))
        .recordReview(review(3, 'approved', 10))
        .dismissReview(2);

      expect(recorded(reviewed)).toMatchObject({
        firstUnblockingReviewAt: at(9),
        firstReviewAt: at(8),
      });
    });

    it('is not unblocked by its author reviewing it', () => {
      expect(
        opened().recordReview(review(1, 'commented', 9, false, 'ada'))
          .firstUnblockingReviewAt,
      ).toBeNull();
    });

    it('was first approved at the earliest approval still standing', () => {
      const reviewed = opened()
        .recordReview(review(1, 'approved', 9))
        .recordReview(review(2, 'changes-requested', 10))
        .recordReview(review(3, 'approved', 11, true))
        .recordReview(review(4, 'approved', 12))
        .dismissReview(1);

      expect(reviewed.firstApprovedAt).toEqual(at(11));
      expect(opened().firstApprovedAt).toBeNull();
    });

    it('says when each person reviewed it, in order, leaving out bots and dismissed reviews', () => {
      const reviewed = opened()
        .recordReview(review(1, 'approved', 12))
        .recordReview(review(2, 'commented', 9))
        .recordReview(review(3, 'commented', 10, true))
        .recordReview(review(4, 'changes-requested', 11))
        .dismissReview(4);

      expect(recorded(reviewed)).toMatchObject({
        humanReviewedAt: [at(9), at(12)],
      });
    });
  });

  describe('bot activity', () => {
    const bot = { byBot: true } as const;

    it('counts what each bot did on it, by login', () => {
      const busy = opened()
        .recordReview(review(1, 'commented', 9, true))
        .recordReview(review(2, 'approved', 10, true, 'renovate[bot]'))
        .recordReview(review(3, 'approved', 11))
        .recordComment(comment(10, 'created', bot))
        .recordComment(comment(11, 'created', { ...bot, answers: 10 }))
        .recordComment(comment(12, 'created', { ...bot, on: 'conversation' }))
        .recordComment(
          comment(13, 'created', { ...bot, login: 'renovate[bot]' }),
        );

      expect(recorded(busy)?.botActivity).toEqual([
        {
          login: 'coderabbitai[bot]',
          reviews: 1,
          comments: 3,
          threads: 1,
          resolvedThreads: 0,
        },
        {
          login: 'renovate[bot]',
          reviews: 1,
          comments: 1,
          threads: 1,
          resolvedThreads: 0,
        },
      ]);
      expect(busy.comments).toEqual([]);
    });

    it('counts a bot comment once, and forgets a deleted one however late its creation is heard', () => {
      const commented = stored(
        opened()
          .recordComment(comment(10, 'created', bot))
          .recordComment(comment(10, 'created', bot))
          .recordComment(comment(10, 'edited', bot))
          .recordComment(
            comment(10, 'created', { ...bot, on: 'conversation' }),
          ),
      );
      const deleted = stored(
        commented.recordComment(comment(10, 'deleted', bot)),
      );
      const deletedFirst = stored(
        opened().recordComment(comment(11, 'deleted', bot)),
      );

      expect(recorded(commented)?.botActivity).toBeUndefined();
      expect(commented.botComments).toHaveLength(2);
      expect(recorded(deleted)?.botActivity).toBeUndefined();
      expect(deleted.botComments.filter((each) => !each.deleted)).toHaveLength(
        1,
      );
      expect(deleted.recordComment(comment(10, 'created', bot))).toBe(deleted);
      expect(deletedFirst.hasEvents).toBe(false);
      expect(deletedFirst.recordComment(comment(11, 'created', bot))).toBe(
        deletedFirst,
      );
    });

    it('counts the threads a bot opened and how many of them are resolved now', () => {
      const threaded = opened()
        .recordComment(comment(10, 'created', bot))
        .resolveThread(thread('PRRT_1', true, { opener: 10 }))
        .resolveThread(thread('PRRT_2', true))
        .resolveThread(thread('PRRT_2', false))
        .resolveThread(thread('PRRT_3', true));

      expect(recorded(threaded)?.botActivity).toEqual([
        {
          login: 'coderabbitai[bot]',
          reviews: 0,
          comments: 1,
          threads: 3,
          resolvedThreads: 2,
        },
      ]);
    });

    it('hears a thread resolved again as nothing new, and leaves a person’s thread out', () => {
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
    const revert = (over: Partial<PullRequestFacts> = {}) =>
      opened({
        url: PullRequestUrl.of('https://github.com/acme/api/pull/9'),
        number: 9,
        title: 'Revert "Retry failed uploads"',
        body: 'Reverts acme/api#7',
        ...over,
      });

    it('says which pull request a revert reverts once it merges', () => {
      const merged = revert().describe(
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
      const reverted = merged.recordRevert(by);

      expect(reverted.revertedBy).toEqual(by);
      expect(recorded(reverted)).toMatchObject({ revertedBy: by.value });
      expect(stored(reverted).recordRevert(by).hasEvents).toBe(false);
    });

    it('marks no open pull request reverted, nor one reverting itself', () => {
      const held = opened();

      expect(
        held.recordRevert(
          PullRequestUrl.of('https://github.com/acme/api/pull/9'),
        ),
      ).toBe(held);

      const merged = opened({ state: 'merged', closedAt: MERGED });
      expect(merged.recordRevert(URL_7)).toBe(merged);
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
