import { PullRequestPurged } from '@github/domain/events/pull-request-purged.event';
import {
  PullRequestRecorded,
  type RecordedPullRequest,
  type RecordedState,
} from '@github/domain/events/pull-request-recorded.event';
import { PullRequestRevertMerged } from '@github/domain/events/pull-request-revert-merged.event';
import type { ReviewState } from '@github/domain/events/pull-request-reviewed.event';
import { botActivityOf } from '@github/domain/services/bot-activity';
import { pastRetention } from '@github/domain/services/pull-request-retention';
import {
  type RevertTarget,
  revertTargetOf,
  sameRevertTarget,
} from '@github/domain/services/revert-convention';
import type {
  BotComment,
  HeardThread,
} from '@github/domain/value-objects/bot-activity.vo';
import {
  type DraftSpell,
  openSpellOf,
  sameSpells,
} from '@github/domain/value-objects/draft-spell.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type PullRequestState = RecordedState;

export interface PullRequestSize {
  readonly additions: number;
  readonly deletions: number;
  readonly changedFiles: number;
}

export interface PullRequestFacts {
  readonly url: PullRequestUrl;
  readonly repository: Repository;
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly branch: string | null;
  readonly size: PullRequestSize | null;
  readonly openedAt: Date;
  readonly draft: boolean;
  readonly markedReadyAt: Date | null;
  readonly markedDraftAt: Date | null;
  readonly state: PullRequestState;
  readonly closedAt: Date | null;
  readonly updatedAt: Date | null;
}

export interface HeardReview {
  readonly id: number;
  readonly state: ReviewState;
  readonly login: string | null;
  readonly byBot: boolean;
  readonly at: Date | null;
}

export interface HeardComment {
  readonly id: number;
  readonly on: 'line' | 'conversation';
  readonly action: 'created' | 'edited' | 'deleted';
  readonly login: string | null;
  readonly answers: number | null;
  readonly byBot: boolean;
}

interface Props {
  readonly title: string;
  readonly author: string | null;
  readonly authorIsBot: boolean;
  readonly branch: string | null;
  readonly size: PullRequestSize | null;
  readonly openedAt: Date;
  readonly draft: boolean;
  readonly readyForReviewAt: Date | null;
  readonly draftSpells: readonly DraftSpell[];
  readonly state: PullRequestState;
  readonly closedAt: Date | null;
  readonly updatedAt: Date;
  readonly reverts: RevertTarget | null;
  readonly reviews: readonly HeardReview[];
  readonly dismissedReviews: readonly number[];
  readonly comments: readonly number[];
  readonly deletedComments: readonly number[];
  readonly botComments: readonly BotComment[];
  readonly threads: readonly HeardThread[];
  readonly revertedBy: PullRequestUrl | null;
}

const VERDICTS: readonly ReviewState[] = ['approved', 'changes-requested'];

const RECORDED = 'pull-request.recorded';

const notRecorded = (event: DomainEvent): boolean => event.kind !== RECORDED;

const atOf = (review: HeardReview): number =>
  review.at?.getTime() ?? Number.POSITIVE_INFINITY;

const earliestOf = (reviews: readonly HeardReview[]): Date | null => {
  const [first] = reviews
    .filter((each) => each.at !== null)
    .sort((a, b) => atOf(a) - atOf(b));

  return first?.at ?? null;
};

const sameSize = (
  one: PullRequestSize | null,
  other: PullRequestSize | null,
): boolean =>
  one === other ||
  (one !== null &&
    other !== null &&
    one.additions === other.additions &&
    one.deletions === other.deletions &&
    one.changedFiles === other.changedFiles);

const sameTime = (one: Date | null, other: Date | null): boolean =>
  (one?.getTime() ?? null) === (other?.getTime() ?? null);

const laterOf = (one: Date, other: Date | null): Date =>
  other && other.getTime() > one.getTime() ? other : one;

const normalOf = (repository: Repository): Repository =>
  Repository.of(repository.value.toLowerCase());

export class PullRequest extends EventRecorder {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly url: PullRequestUrl,
    readonly repository: Repository,
    readonly number: number,
    private readonly kept: Props,
    readonly version: number,
  ) {
    super();
  }

  static heard(
    workspaceId: WorkspaceId,
    facts: PullRequestFacts,
    now: Date,
  ): PullRequest | null {
    const closedAt = facts.state === 'open' ? null : facts.closedAt;
    const updatedAt = laterOf(closedAt ?? facts.openedAt, facts.updatedAt);

    if (pastRetention({ state: facts.state, closedAt, updatedAt }, now)) {
      return null;
    }

    const repository = normalOf(facts.repository);
    const heard = new PullRequest(
      workspaceId,
      facts.url,
      repository,
      facts.number,
      {
        title: facts.title,
        author: facts.author,
        authorIsBot: facts.authorIsBot,
        branch: facts.branch,
        size: facts.size,
        openedAt: facts.openedAt,
        draft: facts.draft,
        readyForReviewAt: facts.draft
          ? null
          : (facts.markedReadyAt ?? facts.openedAt),
        draftSpells:
          facts.draft && facts.markedDraftAt
            ? [{ from: facts.markedDraftAt, to: null }]
            : [],
        state: facts.state,
        closedAt,
        updatedAt,
        reverts: revertTargetOf({ ...facts, repository }),
        reviews: [],
        dismissedReviews: [],
        comments: [],
        deletedComments: [],
        botComments: [],
        threads: [],
        revertedBy: null,
      },
      0,
    );
    heard.recordSnapshot();

    if (facts.state === 'merged') {
      heard.recordRevertMerged();
    }

    return heard;
  }

  static rehydrate(
    input: {
      workspaceId: WorkspaceId;
      url: PullRequestUrl;
      repository: Repository;
      number: number;
      version: number;
    } & Props,
  ): PullRequest {
    return new PullRequest(
      input.workspaceId,
      input.url,
      input.repository,
      input.number,
      {
        title: input.title,
        author: input.author,
        authorIsBot: input.authorIsBot,
        branch: input.branch,
        size: input.size,
        openedAt: input.openedAt,
        draft: input.draft,
        readyForReviewAt: input.readyForReviewAt,
        draftSpells: input.draftSpells,
        state: input.state,
        closedAt: input.closedAt,
        updatedAt: input.updatedAt,
        reverts: input.reverts,
        reviews: input.reviews,
        dismissedReviews: input.dismissedReviews,
        comments: input.comments,
        deletedComments: input.deletedComments,
        botComments: input.botComments,
        threads: input.threads,
        revertedBy: input.revertedBy,
      },
      input.version,
    );
  }

  get title(): string {
    return this.kept.title;
  }

  get author(): string | null {
    return this.kept.author;
  }

  get authorIsBot(): boolean {
    return this.kept.authorIsBot;
  }

  get branch(): string | null {
    return this.kept.branch;
  }

  get size(): PullRequestSize | null {
    return this.kept.size;
  }

  get openedAt(): Date {
    return this.kept.openedAt;
  }

  get draft(): boolean {
    return this.kept.draft;
  }

  get readyForReviewAt(): Date | null {
    return this.kept.readyForReviewAt;
  }

  get draftSpells(): readonly DraftSpell[] {
    return this.kept.draftSpells;
  }

  get state(): PullRequestState {
    return this.kept.state;
  }

  get closedAt(): Date | null {
    return this.kept.closedAt;
  }

  get updatedAt(): Date {
    return this.kept.updatedAt;
  }

  get reverts(): RevertTarget | null {
    return this.kept.reverts;
  }

  get reviews(): readonly HeardReview[] {
    return this.kept.reviews;
  }

  get dismissedReviews(): readonly number[] {
    return this.kept.dismissedReviews;
  }

  get comments(): readonly number[] {
    return this.kept.comments;
  }

  get deletedComments(): readonly number[] {
    return this.kept.deletedComments;
  }

  get botComments(): readonly BotComment[] {
    return this.kept.botComments;
  }

  get threads(): readonly HeardThread[] {
    return this.kept.threads;
  }

  get revertedBy(): PullRequestUrl | null {
    return this.kept.revertedBy;
  }

  get merged(): boolean {
    return this.kept.state === 'merged';
  }

  get firstReviewAt(): Date | null {
    return earliestOf(this.byPeople());
  }

  get firstUnblockingReviewAt(): Date | null {
    return earliestOf(
      this.kept.reviews.filter(
        (each) => this.kept.author === null || each.login !== this.kept.author,
      ),
    );
  }

  get firstApprovedAt(): Date | null {
    return earliestOf(
      this.kept.reviews.filter(
        (each) =>
          each.state === 'approved' &&
          !this.kept.dismissedReviews.includes(each.id),
      ),
    );
  }

  get humanReviewedAt(): readonly Date[] {
    return this.byPeople()
      .flatMap((each) => (each.at ? [each.at] : []))
      .sort((a, b) => a.getTime() - b.getTime());
  }

  get reviewRounds(): number {
    const reviews = [...this.byPeople()].sort((a, b) => atOf(a) - atOf(b));
    const verdicts = reviews.filter((each) => VERDICTS.includes(each.state));
    const last = verdicts[verdicts.length - 1];
    const after = last ? reviews.slice(reviews.indexOf(last) + 1) : reviews;

    return verdicts.length + (after.length > 0 ? 1 : 0);
  }

  isPastRetention(now: Date): boolean {
    return pastRetention(this.kept, now);
  }

  describe(facts: PullRequestFacts): PullRequest {
    if (!facts.url.equals(this.url)) {
      return this;
    }

    const readiedEarlier =
      !facts.draft &&
      facts.markedReadyAt !== null &&
      (this.kept.readyForReviewAt === null ||
        facts.markedReadyAt.getTime() < this.kept.readyForReviewAt.getTime());

    if (
      facts.updatedAt !== null &&
      facts.updatedAt.getTime() < this.kept.updatedAt.getTime()
    ) {
      return readiedEarlier
        ? this.changed({ ...this.kept, readyForReviewAt: facts.markedReadyAt })
        : this;
    }

    const state: PullRequestState =
      this.kept.state === 'merged'
        ? 'merged'
        : this.kept.state === 'closed' &&
            facts.state === 'open' &&
            !this.newerThanKept(facts.updatedAt)
          ? 'closed'
          : facts.state;
    const closedAt =
      state === 'open'
        ? null
        : this.kept.state === 'merged'
          ? this.kept.closedAt
          : (facts.closedAt ?? this.kept.closedAt);
    const next: Props = {
      ...this.kept,
      title: facts.title,
      author: facts.author ?? this.kept.author,
      authorIsBot: facts.author ? facts.authorIsBot : this.kept.authorIsBot,
      branch: facts.branch ?? this.kept.branch,
      size: facts.size ?? this.kept.size,
      openedAt: facts.openedAt,
      draft: facts.draft,
      readyForReviewAt: readiedEarlier
        ? facts.markedReadyAt
        : (this.kept.readyForReviewAt ??
          (facts.draft
            ? null
            : (facts.markedReadyAt ??
              laterOf(this.kept.updatedAt, facts.updatedAt)))),
      draftSpells: this.respelled(facts),
      state,
      closedAt,
      updatedAt: laterOf(this.kept.updatedAt, facts.updatedAt),
      reverts: revertTargetOf({
        title: facts.title,
        body: facts.body,
        repository: this.repository,
      }),
    };

    if (this.unchanged(next)) {
      return sameTime(next.updatedAt, this.kept.updatedAt)
        ? this
        : this.quietly(next);
    }

    const described = this.changed(next);

    if (this.kept.state !== 'merged' && state === 'merged') {
      described.recordRevertMerged();
    }

    return described;
  }

  recordReview(review: HeardReview): PullRequest {
    if (this.kept.reviews.some((each) => each.id === review.id)) {
      return this;
    }

    return this.changed({
      ...this.kept,
      reviews: [...this.kept.reviews, review],
    });
  }

  dismissReview(id: number): PullRequest {
    if (this.kept.dismissedReviews.includes(id)) {
      return this;
    }

    const next = {
      ...this.kept,
      dismissedReviews: [...this.kept.dismissedReviews, id],
    };

    return this.kept.reviews.some((each) => each.id === id)
      ? this.changed(next)
      : this.quietly(next);
  }

  recordComment(comment: HeardComment): PullRequest {
    if (comment.byBot) {
      return this.botCommented(comment);
    }

    if (comment.on === 'conversation') {
      return this;
    }

    const known = this.kept.comments.includes(comment.id);
    const deleted = this.kept.deletedComments.includes(comment.id);

    if (comment.action === 'deleted' && !deleted) {
      const next = {
        ...this.kept,
        comments: this.kept.comments.filter((each) => each !== comment.id),
        deletedComments: [...this.kept.deletedComments, comment.id],
      };

      return known ? this.changed(next) : this.quietly(next);
    }

    if (comment.action === 'created' && !known && !deleted) {
      return this.changed({
        ...this.kept,
        comments: [...this.kept.comments, comment.id],
      });
    }

    return this;
  }

  resolveThread(thread: HeardThread): PullRequest {
    const known = this.kept.threads.find((each) => each.id === thread.id);

    if (!thread.byBot || (known && known.resolved === thread.resolved)) {
      return this;
    }

    return this.changed({
      ...this.kept,
      threads: [
        ...this.kept.threads.filter((each) => each.id !== thread.id),
        thread,
      ],
    });
  }

  recordRevert(revert: PullRequestUrl): PullRequest {
    if (
      !this.merged ||
      revert.equals(this.url) ||
      this.kept.revertedBy?.equals(revert)
    ) {
      return this;
    }

    return this.changed({ ...this.kept, revertedBy: revert });
  }

  purge(): PullRequest {
    const purged = this.succeeded(this.kept, notRecorded);
    purged.record(
      new PullRequestPurged(
        this.workspaceId,
        this.url.value,
        this.kept.updatedAt,
      ),
    );

    return purged;
  }

  private newerThanKept(updatedAt: Date | null): boolean {
    return (
      updatedAt !== null && updatedAt.getTime() > this.kept.updatedAt.getTime()
    );
  }

  private botCommented(comment: HeardComment): PullRequest {
    const known = this.kept.botComments.find(
      (each) => each.id === comment.id && each.on === comment.on,
    );
    const deleted = comment.action === 'deleted';

    if (
      !comment.login ||
      comment.action === 'edited' ||
      known?.deleted ||
      (known && !deleted)
    ) {
      return this;
    }

    const next = {
      ...this.kept,
      botComments: [
        ...this.kept.botComments.filter((each) => each !== known),
        {
          id: comment.id,
          on: comment.on,
          login: comment.login,
          opensThread: comment.on === 'line' && comment.answers === null,
          deleted,
        },
      ],
    };

    return deleted && !known ? this.quietly(next) : this.changed(next);
  }

  private respelled(facts: PullRequestFacts): readonly DraftSpell[] {
    const spells = this.kept.draftSpells;
    const open = openSpellOf(spells);
    const heardAt = facts.updatedAt ?? this.kept.updatedAt;

    const wasReady =
      this.kept.readyForReviewAt !== null || facts.markedDraftAt !== null;

    if (facts.draft && !open && wasReady) {
      return [...spells, { from: facts.markedDraftAt ?? heardAt, to: null }];
    }

    if (!facts.draft && open) {
      return [
        ...spells.slice(0, -1),
        { from: open.from, to: facts.markedReadyAt ?? heardAt },
      ];
    }

    return spells;
  }

  private byPeople(): readonly HeardReview[] {
    return this.kept.reviews.filter(
      (each) => !each.byBot && !this.kept.dismissedReviews.includes(each.id),
    );
  }

  private unchanged(next: Props): boolean {
    return (
      next.title === this.kept.title &&
      next.author === this.kept.author &&
      next.authorIsBot === this.kept.authorIsBot &&
      next.branch === this.kept.branch &&
      sameSize(next.size, this.kept.size) &&
      sameTime(next.openedAt, this.kept.openedAt) &&
      next.draft === this.kept.draft &&
      sameTime(next.readyForReviewAt, this.kept.readyForReviewAt) &&
      sameSpells(next.draftSpells, this.kept.draftSpells) &&
      next.state === this.kept.state &&
      sameTime(next.closedAt, this.kept.closedAt) &&
      sameRevertTarget(next.reverts, this.kept.reverts)
    );
  }

  private changed(next: Props): PullRequest {
    const changed = this.succeeded(next, notRecorded);
    changed.recordSnapshot();

    return changed;
  }

  private quietly(next: Props): PullRequest {
    return this.succeeded(next, () => true);
  }

  private succeeded(
    next: Props,
    keeping: (event: DomainEvent) => boolean,
  ): PullRequest {
    const succeeded = new PullRequest(
      this.workspaceId,
      this.url,
      this.repository,
      this.number,
      next,
      this.version,
    );
    succeeded.inheritEvents(this, keeping);

    return succeeded;
  }

  private recordSnapshot(): void {
    this.record(new PullRequestRecorded(this.workspaceId, this.snapshot()));
  }

  private recordRevertMerged(): void {
    if (this.kept.reverts) {
      this.record(
        new PullRequestRevertMerged(
          this.workspaceId,
          this.url.value,
          this.repository.value,
          this.kept.reverts,
          this.kept.closedAt,
        ),
      );
    }
  }

  private snapshot(): RecordedPullRequest {
    return {
      pullRequest: this.url.value,
      repository: this.repository.value,
      number: this.number,
      title: this.kept.title,
      author: this.kept.author,
      authorIsBot: this.kept.authorIsBot,
      branch: this.kept.branch,
      additions: this.kept.size?.additions ?? null,
      deletions: this.kept.size?.deletions ?? null,
      changedFiles: this.kept.size?.changedFiles ?? null,
      openedAt: this.kept.openedAt,
      state: this.kept.state,
      closedAt: this.kept.closedAt,
      updatedAt: this.kept.updatedAt,
      readyForReviewAt: this.kept.readyForReviewAt,
      draftSpells: this.kept.draftSpells,
      firstReviewAt: this.firstReviewAt,
      firstUnblockingReviewAt: this.firstUnblockingReviewAt,
      firstApprovedAt: this.firstApprovedAt,
      humanReviewedAt: this.humanReviewedAt,
      reviews: this.byPeople().length,
      reviewRounds: this.reviewRounds,
      reviewComments: this.kept.comments.length,
      botActivity: botActivityOf(this.kept),
      isRevert: this.kept.reverts !== null,
      revertedBy: this.kept.revertedBy?.value ?? null,
      version: this.version + 1,
    };
  }
}
