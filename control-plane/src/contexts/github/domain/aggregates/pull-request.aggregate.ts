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
  PullRequestThread,
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

export interface WebhookReview {
  readonly id: number;
  readonly state: ReviewState;
  readonly login: string | null;
  readonly byBot: boolean;
  readonly at: Date | null;
}

export interface WebhookComment {
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
  readonly reviews: readonly WebhookReview[];
  readonly dismissedReviews: readonly number[];
  readonly comments: readonly number[];
  readonly deletedComments: readonly number[];
  readonly botComments: readonly BotComment[];
  readonly threads: readonly PullRequestThread[];
  readonly revertedBy: PullRequestUrl | null;
}

const VERDICTS: readonly ReviewState[] = ['approved', 'changes-requested'];

const RECORDED = 'pull-request.recorded';

const notRecorded = (event: DomainEvent): boolean => event.kind !== RECORDED;

const atOf = (review: WebhookReview): number =>
  review.at?.getTime() ?? Number.POSITIVE_INFINITY;

const earliestOf = (reviews: readonly WebhookReview[]): Date | null => {
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
    private readonly props: Props,
    readonly version: number,
  ) {
    super();
  }

  static fromWebhook(
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
    const created = new PullRequest(
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
    created.recordSnapshot();

    if (facts.state === 'merged') {
      created.recordRevertMerged();
    }

    return created;
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
    return this.props.title;
  }

  get author(): string | null {
    return this.props.author;
  }

  get authorIsBot(): boolean {
    return this.props.authorIsBot;
  }

  get branch(): string | null {
    return this.props.branch;
  }

  get size(): PullRequestSize | null {
    return this.props.size;
  }

  get openedAt(): Date {
    return this.props.openedAt;
  }

  get draft(): boolean {
    return this.props.draft;
  }

  get readyForReviewAt(): Date | null {
    return this.props.readyForReviewAt;
  }

  get draftSpells(): readonly DraftSpell[] {
    return this.props.draftSpells;
  }

  get state(): PullRequestState {
    return this.props.state;
  }

  get closedAt(): Date | null {
    return this.props.closedAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get reverts(): RevertTarget | null {
    return this.props.reverts;
  }

  get reviews(): readonly WebhookReview[] {
    return this.props.reviews;
  }

  get dismissedReviews(): readonly number[] {
    return this.props.dismissedReviews;
  }

  get comments(): readonly number[] {
    return this.props.comments;
  }

  get deletedComments(): readonly number[] {
    return this.props.deletedComments;
  }

  get botComments(): readonly BotComment[] {
    return this.props.botComments;
  }

  get threads(): readonly PullRequestThread[] {
    return this.props.threads;
  }

  get revertedBy(): PullRequestUrl | null {
    return this.props.revertedBy;
  }

  get merged(): boolean {
    return this.props.state === 'merged';
  }

  get firstReviewAt(): Date | null {
    return earliestOf(this.byPeople());
  }

  get firstUnblockingReviewAt(): Date | null {
    return earliestOf(
      this.props.reviews.filter(
        (each) =>
          this.props.author === null || each.login !== this.props.author,
      ),
    );
  }

  get firstApprovedAt(): Date | null {
    return earliestOf(
      this.props.reviews.filter(
        (each) =>
          each.state === 'approved' &&
          !this.props.dismissedReviews.includes(each.id),
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
    return pastRetention(this.props, now);
  }

  describe(facts: PullRequestFacts): PullRequest {
    if (!facts.url.equals(this.url)) {
      return this;
    }

    const readiedEarlier =
      !facts.draft &&
      facts.markedReadyAt !== null &&
      (this.props.readyForReviewAt === null ||
        facts.markedReadyAt.getTime() < this.props.readyForReviewAt.getTime());

    if (
      facts.updatedAt !== null &&
      facts.updatedAt.getTime() < this.props.updatedAt.getTime()
    ) {
      return readiedEarlier
        ? this.changed({ ...this.props, readyForReviewAt: facts.markedReadyAt })
        : this;
    }

    const state: PullRequestState =
      this.props.state === 'merged'
        ? 'merged'
        : this.props.state === 'closed' &&
            facts.state === 'open' &&
            !this.newerThanStored(facts.updatedAt)
          ? 'closed'
          : facts.state;
    const closedAt =
      state === 'open'
        ? null
        : this.props.state === 'merged'
          ? this.props.closedAt
          : (facts.closedAt ?? this.props.closedAt);
    const next: Props = {
      ...this.props,
      title: facts.title,
      author: facts.author ?? this.props.author,
      authorIsBot: facts.author ? facts.authorIsBot : this.props.authorIsBot,
      branch: facts.branch ?? this.props.branch,
      size: facts.size ?? this.props.size,
      openedAt: facts.openedAt,
      draft: facts.draft,
      readyForReviewAt: readiedEarlier
        ? facts.markedReadyAt
        : (this.props.readyForReviewAt ??
          (facts.draft
            ? null
            : (facts.markedReadyAt ??
              laterOf(this.props.updatedAt, facts.updatedAt)))),
      draftSpells: this.respelled(facts),
      state,
      closedAt,
      updatedAt: laterOf(this.props.updatedAt, facts.updatedAt),
      reverts: revertTargetOf({
        title: facts.title,
        body: facts.body,
        repository: this.repository,
      }),
    };

    if (this.unchanged(next)) {
      return sameTime(next.updatedAt, this.props.updatedAt)
        ? this
        : this.quietly(next);
    }

    const described = this.changed(next);

    if (this.props.state !== 'merged' && state === 'merged') {
      described.recordRevertMerged();
    }

    return described;
  }

  recordReview(review: WebhookReview): PullRequest {
    if (this.props.reviews.some((each) => each.id === review.id)) {
      return this;
    }

    return this.changed({
      ...this.props,
      reviews: [...this.props.reviews, review],
    });
  }

  dismissReview(id: number): PullRequest {
    if (this.props.dismissedReviews.includes(id)) {
      return this;
    }

    const next = {
      ...this.props,
      dismissedReviews: [...this.props.dismissedReviews, id],
    };

    return this.props.reviews.some((each) => each.id === id)
      ? this.changed(next)
      : this.quietly(next);
  }

  recordComment(comment: WebhookComment): PullRequest {
    if (comment.byBot) {
      return this.botCommented(comment);
    }

    if (comment.on === 'conversation') {
      return this;
    }

    const known = this.props.comments.includes(comment.id);
    const deleted = this.props.deletedComments.includes(comment.id);

    if (comment.action === 'deleted' && !deleted) {
      const next = {
        ...this.props,
        comments: this.props.comments.filter((each) => each !== comment.id),
        deletedComments: [...this.props.deletedComments, comment.id],
      };

      return known ? this.changed(next) : this.quietly(next);
    }

    if (comment.action === 'created' && !known && !deleted) {
      return this.changed({
        ...this.props,
        comments: [...this.props.comments, comment.id],
      });
    }

    return this;
  }

  resolveThread(thread: PullRequestThread): PullRequest {
    const known = this.props.threads.find((each) => each.id === thread.id);

    if (!thread.byBot || (known && known.resolved === thread.resolved)) {
      return this;
    }

    return this.changed({
      ...this.props,
      threads: [
        ...this.props.threads.filter((each) => each.id !== thread.id),
        thread,
      ],
    });
  }

  recordRevert(revert: PullRequestUrl): PullRequest {
    if (
      !this.merged ||
      revert.equals(this.url) ||
      this.props.revertedBy?.equals(revert)
    ) {
      return this;
    }

    return this.changed({ ...this.props, revertedBy: revert });
  }

  purge(): PullRequest {
    const purged = this.succeeded(this.props, notRecorded);
    purged.record(
      new PullRequestPurged(
        this.workspaceId,
        this.url.value,
        this.props.updatedAt,
      ),
    );

    return purged;
  }

  private newerThanStored(updatedAt: Date | null): boolean {
    return (
      updatedAt !== null && updatedAt.getTime() > this.props.updatedAt.getTime()
    );
  }

  private botCommented(comment: WebhookComment): PullRequest {
    const known = this.props.botComments.find(
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
      ...this.props,
      botComments: [
        ...this.props.botComments.filter((each) => each !== known),
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
    const spells = this.props.draftSpells;
    const open = openSpellOf(spells);
    const lastUpdatedAt = facts.updatedAt ?? this.props.updatedAt;

    const wasReady =
      this.props.readyForReviewAt !== null || facts.markedDraftAt !== null;

    if (facts.draft && !open && wasReady) {
      return [
        ...spells,
        { from: facts.markedDraftAt ?? lastUpdatedAt, to: null },
      ];
    }

    if (!facts.draft && open) {
      return [
        ...spells.slice(0, -1),
        { from: open.from, to: facts.markedReadyAt ?? lastUpdatedAt },
      ];
    }

    return spells;
  }

  private byPeople(): readonly WebhookReview[] {
    return this.props.reviews.filter(
      (each) => !each.byBot && !this.props.dismissedReviews.includes(each.id),
    );
  }

  private unchanged(next: Props): boolean {
    return (
      next.title === this.props.title &&
      next.author === this.props.author &&
      next.authorIsBot === this.props.authorIsBot &&
      next.branch === this.props.branch &&
      sameSize(next.size, this.props.size) &&
      sameTime(next.openedAt, this.props.openedAt) &&
      next.draft === this.props.draft &&
      sameTime(next.readyForReviewAt, this.props.readyForReviewAt) &&
      sameSpells(next.draftSpells, this.props.draftSpells) &&
      next.state === this.props.state &&
      sameTime(next.closedAt, this.props.closedAt) &&
      sameRevertTarget(next.reverts, this.props.reverts)
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
    including: (event: DomainEvent) => boolean,
  ): PullRequest {
    const succeeded = new PullRequest(
      this.workspaceId,
      this.url,
      this.repository,
      this.number,
      next,
      this.version,
    );
    succeeded.inheritEvents(this, including);

    return succeeded;
  }

  private recordSnapshot(): void {
    this.record(new PullRequestRecorded(this.workspaceId, this.snapshot()));
  }

  private recordRevertMerged(): void {
    if (this.props.reverts) {
      this.record(
        new PullRequestRevertMerged(
          this.workspaceId,
          this.url.value,
          this.repository.value,
          this.props.reverts,
          this.props.closedAt,
        ),
      );
    }
  }

  private snapshot(): RecordedPullRequest {
    return {
      pullRequest: this.url.value,
      repository: this.repository.value,
      number: this.number,
      title: this.props.title,
      author: this.props.author,
      authorIsBot: this.props.authorIsBot,
      branch: this.props.branch,
      additions: this.props.size?.additions ?? null,
      deletions: this.props.size?.deletions ?? null,
      changedFiles: this.props.size?.changedFiles ?? null,
      openedAt: this.props.openedAt,
      state: this.props.state,
      closedAt: this.props.closedAt,
      updatedAt: this.props.updatedAt,
      readyForReviewAt: this.props.readyForReviewAt,
      draftSpells: this.props.draftSpells,
      firstReviewAt: this.firstReviewAt,
      firstUnblockingReviewAt: this.firstUnblockingReviewAt,
      firstApprovedAt: this.firstApprovedAt,
      humanReviewedAt: this.humanReviewedAt,
      reviews: this.byPeople().length,
      reviewRounds: this.reviewRounds,
      reviewComments: this.props.comments.length,
      botActivity: botActivityOf(this.props),
      isRevert: this.props.reverts !== null,
      revertedBy: this.props.revertedBy?.value ?? null,
      version: this.version + 1,
    };
  }
}
