import {
  type ObservedBotComment,
  type ObservedReview,
  type ObservedReviewActivity,
  type ObservedThread,
  reviewMetricsOf,
} from '@insights/domain/services/pull-request-review-metrics';
import { describe, expect, it } from 'vitest';

const at = (hour: number) =>
  new Date(`2026-09-20T${String(hour).padStart(2, '0')}:00:00Z`);

const BOT = 'coderabbitai[bot]';

const review = (
  id: number,
  state: ObservedReview['state'],
  hour: number,
  over: Partial<ObservedReview> = {},
): ObservedReview => ({
  id,
  state,
  login: over.byBot ? BOT : 'grace',
  byBot: false,
  at: at(hour),
  dismissed: false,
  ...over,
});

const comment = (
  id: number,
  over: Partial<ObservedBotComment> = {},
): ObservedBotComment => ({
  id,
  on: 'line',
  login: BOT,
  opensThread: true,
  deleted: false,
  ...over,
});

const thread = (
  id: string,
  resolved: boolean,
  over: Partial<ObservedThread> = {},
): ObservedThread => ({
  id,
  firstCommentId: null,
  login: BOT,
  byBot: true,
  resolved,
  ...over,
});

const metricsOf = (over: Partial<ObservedReviewActivity> = {}) =>
  reviewMetricsOf({
    author: 'ada',
    reviews: [],
    botComments: [],
    threads: [],
    ...over,
  });

describe('reviewMetricsOf', () => {
  describe('review rounds', () => {
    it('counts no round before anyone reviews', () => {
      expect(metricsOf()).toMatchObject({ reviewRounds: 0, reviews: 0 });
    });

    it('counts each approval or request for changes by a person as a round', () => {
      expect(
        metricsOf({
          reviews: [
            review(1, 'changes-requested', 9),
            review(2, 'commented', 10),
            review(3, 'approved', 11),
          ],
        }).reviewRounds,
      ).toBe(2);
    });

    it('counts comments after the last verdict as a round still open', () => {
      expect(
        metricsOf({
          reviews: [
            review(1, 'changes-requested', 9),
            review(2, 'commented', 10),
          ],
        }).reviewRounds,
      ).toBe(2);
    });

    it('counts comments with no verdict as one round', () => {
      expect(
        metricsOf({
          reviews: [review(1, 'commented', 9), review(2, 'commented', 10)],
        }).reviewRounds,
      ).toBe(1);
    });

    it('leaves out what bots said', () => {
      expect(
        metricsOf({
          reviews: [
            review(1, 'approved', 9, { byBot: true }),
            review(2, 'approved', 10),
          ],
        }),
      ).toMatchObject({ reviewRounds: 1, reviews: 1, firstReviewAt: at(10) });
    });

    it('leaves out a dismissed review, which still unblocks', () => {
      expect(
        metricsOf({
          reviews: [
            review(1, 'changes-requested', 9, { dismissed: true }),
            review(2, 'approved', 10),
          ],
        }),
      ).toMatchObject({
        reviewRounds: 1,
        reviews: 1,
        firstReviewAt: at(10),
        firstUnblockingReviewAt: at(9),
      });
      expect(
        metricsOf({
          reviews: [review(1, 'changes-requested', 9, { dismissed: true })],
        }),
      ).toMatchObject({ reviewRounds: 0, reviews: 0, firstReviewAt: null });
    });

    it('takes the earliest review by a person as the first, whatever order it came in', () => {
      expect(
        metricsOf({
          reviews: [review(1, 'approved', 11), review(2, 'commented', 9)],
        }).firstReviewAt,
      ).toEqual(at(9));
    });
  });

  describe('review times', () => {
    it('is first unblocked by the earliest review of anyone but its author, bots and dismissed reviews included', () => {
      expect(
        metricsOf({
          reviews: [
            review(1, 'commented', 8, { login: 'ada' }),
            review(2, 'commented', 9, { byBot: true, dismissed: true }),
            review(3, 'approved', 10),
          ],
        }),
      ).toMatchObject({ firstUnblockingReviewAt: at(9), firstReviewAt: at(8) });
    });

    it('is not unblocked by its author reviewing it', () => {
      expect(
        metricsOf({ reviews: [review(1, 'commented', 9, { login: 'ada' })] })
          .firstUnblockingReviewAt,
      ).toBeNull();
    });

    it('was first approved at the earliest approval that is still valid', () => {
      expect(
        metricsOf({
          reviews: [
            review(1, 'approved', 9, { dismissed: true }),
            review(2, 'changes-requested', 10),
            review(3, 'approved', 11, { byBot: true }),
            review(4, 'approved', 12),
          ],
        }).firstApprovedAt,
      ).toEqual(at(11));
      expect(metricsOf().firstApprovedAt).toBeNull();
    });

    it('says when each person reviewed it, in order, leaving out bots and dismissed reviews', () => {
      expect(
        metricsOf({
          reviews: [
            review(1, 'approved', 12),
            review(2, 'commented', 9),
            review(3, 'commented', 10, { byBot: true }),
            review(4, 'changes-requested', 11, { dismissed: true }),
          ],
        }).humanReviewedAt,
      ).toEqual([at(9), at(12)]);
    });
  });

  describe('bot activity', () => {
    it('counts what each bot did on it, by login', () => {
      expect(
        metricsOf({
          reviews: [
            review(1, 'commented', 9, { byBot: true }),
            review(2, 'approved', 10, { byBot: true, login: 'renovate[bot]' }),
            review(3, 'approved', 11),
          ],
          botComments: [
            comment(10),
            comment(11, { opensThread: false }),
            comment(12, { on: 'conversation', opensThread: false }),
            comment(13, { login: 'renovate[bot]' }),
          ],
        }).botActivity,
      ).toEqual([
        {
          login: BOT,
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
    });

    it('leaves out a deleted bot comment', () => {
      expect(
        metricsOf({ botComments: [comment(10, { deleted: true })] })
          .botActivity,
      ).toEqual([
        { login: BOT, reviews: 0, comments: 0, threads: 0, resolvedThreads: 0 },
      ]);
    });

    it('counts the threads a bot opened and how many of them are resolved now', () => {
      expect(
        metricsOf({
          botComments: [comment(10)],
          threads: [
            thread('PRRT_1', true, { firstCommentId: 10 }),
            thread('PRRT_2', false),
            thread('PRRT_3', true),
          ],
        }).botActivity,
      ).toEqual([
        {
          login: BOT,
          reviews: 0,
          comments: 1,
          threads: 3,
          resolvedThreads: 2,
        },
      ]);
    });

    it('leaves a person’s thread out', () => {
      expect(
        metricsOf({
          threads: [thread('PRRT_1', true, { login: 'grace', byBot: false })],
        }).botActivity,
      ).toEqual([]);
    });
  });
});
