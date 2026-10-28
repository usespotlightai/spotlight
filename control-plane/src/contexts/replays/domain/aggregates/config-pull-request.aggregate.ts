import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { ConfigPullRequestClosed } from '@replays/domain/events/config-pull-request-closed.event';
import { ConfigPullRequestFailed } from '@replays/domain/events/config-pull-request-failed.event';
import { ConfigPullRequestMerged } from '@replays/domain/events/config-pull-request-merged.event';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestReopened } from '@replays/domain/events/config-pull-request-reopened.event';
import { ConfigPullRequestRequested } from '@replays/domain/events/config-pull-request-requested.event';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestDetail } from '@replays/domain/value-objects/config-pull-request-detail.vo';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import {
  type ConfigPullRequestCloseReason,
  type ConfigPullRequestState,
  OPEN_CONFIG_PULL_REQUEST_STATES,
} from '@replays/domain/value-objects/config-pull-request-state';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MAX_RETRIES = 5;

const FIRST_RETRY_MS = 30_000;

const RETRY_GROWTH = 4;

const retryAfterMs = (retries: number): number =>
  FIRST_RETRY_MS * RETRY_GROWTH ** (Math.min(retries, MAX_RETRIES) - 1);

const AGGREGATE = 'config pull request';

const SEARCH_PREFIX = 8;

const ON_GITHUB: readonly ConfigPullRequestState[] = [
  'opened',
  'closing',
  'merged',
  'closed',
];

const DUE: readonly ConfigPullRequestState[] = ['opening', 'closing'];

export interface OpenedPullRequest {
  readonly url: PullRequestUrl;
  readonly number: number;
  readonly gitHubId: number;
  readonly repository: Repository;
  readonly basedOn: StationFingerprint;
  readonly proposing: StationFingerprint;
}

export interface GitHubClose {
  readonly merged: boolean;
  readonly at: Date;
}

export interface GitHubPullRequest {
  readonly repository: Repository;
  readonly number: number;
}

export interface ConfigSourceOf {
  readonly repository: Repository;
  readonly path: string;
}

interface State {
  readonly id: ConfigPullRequestId;
  readonly searchId: SearchId;
  readonly candidateId: CandidateId;
  readonly station: ReplayedStation;
  readonly stationKey: string;
  readonly candidateName: string;
  readonly repository: string | null;
  readonly path: string | null;
  readonly branch: string;
  readonly state: ConfigPullRequestState;
  readonly url: string | null;
  readonly number: number | null;
  readonly gitHubId: number | null;
  readonly basedOn: StationFingerprint | null;
  readonly proposing: StationFingerprint | null;
  readonly checkedAt: Date | null;
  readonly closedBecause: ConfigPullRequestCloseReason | null;
  readonly closeFailure: ConfigPullRequestReason | null;
  readonly reason: ConfigPullRequestReason | null;
  readonly retries: number;
  readonly lastCommit: string | null;
  readonly dueAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

const slugOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'candidate';

export class ConfigPullRequest extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static branchFor(searchId: SearchId, candidateName: string): string {
    return `spotlight/search-${searchId.value.slice(0, SEARCH_PREFIX)}-${slugOf(candidateName)}`;
  }

  static pick(input: {
    id: ConfigPullRequestId;
    searchId: SearchId;
    candidateId: CandidateId;
    station: ReplayedStation;
    stationKey: string;
    candidateName: string;
    lineKey: string;
    source: ConfigSourceOf | null;
    at: Date;
    by: ChangeActor;
  }): ConfigPullRequest {
    const picked = new ConfigPullRequest({
      id: input.id,
      searchId: input.searchId,
      candidateId: input.candidateId,
      station: input.station,
      stationKey: input.stationKey,
      candidateName: input.candidateName,
      branch: ConfigPullRequest.branchFor(input.searchId, input.candidateName),
      createdAt: input.at,
      lastCommit: null,
      version: 0,
      ...ConfigPullRequest.attempted(input.source, input.lineKey, input.at),
    });

    picked.record(picked.wanted(input.by));

    if (picked.state.reason) {
      picked.record(picked.failureOf(picked.state.reason));
    }

    return picked;
  }

  static rehydrate(state: State): ConfigPullRequest {
    const { state: current, url, reason, repository, path } = state;

    const onGitHub = ON_GITHUB.includes(current);

    if (
      [
        url,
        state.number,
        state.gitHubId,
        state.basedOn,
        state.proposing,
        state.checkedAt,
      ].some((each) => (each !== null) !== onGitHub)
    ) {
      throw new InconsistentStateError(
        AGGREGATE,
        'has a pull request link, number, GitHub id, fingerprints and check time when, and only when, it opened',
      );
    }
    if (
      state.closeFailure !== null &&
      (current !== 'closed' || state.closedBecause !== 'stale')
    ) {
      throw new InconsistentStateError(
        AGGREGATE,
        'records a close failure only once it closed as stale',
      );
    }
    if (
      (current === 'closing' || current === 'closed') !==
        (state.closedBecause !== null) ||
      (current === 'closing' && state.closedBecause !== 'stale')
    ) {
      throw new InconsistentStateError(
        AGGREGATE,
        'says why it closed when, and only when, it closes or closed',
      );
    }
    if ((current === 'failed') !== (reason !== null)) {
      throw new InconsistentStateError(
        AGGREGATE,
        'says why when, and only when, it failed',
      );
    }
    if (current !== 'failed' && (repository === null || path === null)) {
      throw new InconsistentStateError(
        AGGREGATE,
        'knows the repository and file it opens against unless it failed',
      );
    }
    if (DUE.includes(current) !== (state.dueAt !== null)) {
      throw new InconsistentStateError(
        AGGREGATE,
        'is due to be tried when, and only when, it is opening or closing',
      );
    }
    return new ConfigPullRequest(state);
  }

  private static attempted(
    source: ConfigSourceOf | null,
    lineKey: string,
    at: Date,
  ): Pick<
    State,
    | 'repository'
    | 'path'
    | 'state'
    | 'url'
    | 'number'
    | 'gitHubId'
    | 'basedOn'
    | 'proposing'
    | 'checkedAt'
    | 'closedBecause'
    | 'closeFailure'
    | 'reason'
    | 'retries'
    | 'dueAt'
    | 'updatedAt'
  > {
    return {
      repository: source?.repository.value ?? null,
      path: source?.path ?? null,
      state: source ? 'opening' : 'failed',
      url: null,
      number: null,
      gitHubId: null,
      basedOn: null,
      proposing: null,
      checkedAt: null,
      closedBecause: null,
      closeFailure: null,
      reason: source ? null : ConfigPullRequestReason.noSource(lineKey),
      retries: 0,
      dueAt: source ? at : null,
      updatedAt: at,
    };
  }

  get id(): ConfigPullRequestId {
    return this.state.id;
  }

  get searchId(): SearchId {
    return this.state.searchId;
  }

  get candidateId(): CandidateId {
    return this.state.candidateId;
  }

  get station(): ReplayedStation {
    return this.state.station;
  }

  get workspaceId(): WorkspaceId {
    return this.state.station.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.station.teamId;
  }

  get stationKey(): string {
    return this.state.stationKey;
  }

  get candidateName(): string {
    return this.state.candidateName;
  }

  get repository(): string | null {
    return this.state.repository;
  }

  get path(): string | null {
    return this.state.path;
  }

  get branch(): string {
    return this.state.branch;
  }

  get current(): ConfigPullRequestState {
    return this.state.state;
  }

  get url(): string | null {
    return this.state.url;
  }

  get number(): number | null {
    return this.state.number;
  }

  get basedOn(): StationFingerprint | null {
    return this.state.basedOn;
  }

  get proposing(): StationFingerprint | null {
    return this.state.proposing;
  }

  get gitHubId(): number | null {
    return this.state.gitHubId;
  }

  get checkedAt(): Date | null {
    return this.state.checkedAt;
  }

  get closedBecause(): ConfigPullRequestCloseReason | null {
    return this.state.closedBecause;
  }

  get closeFailure(): ConfigPullRequestReason | null {
    return this.state.closeFailure;
  }

  get gitHubPullRequest(): GitHubPullRequest | null {
    const { repository, number } = this.state;

    return repository && number !== null
      ? { repository: Repository.of(repository), number }
      : null;
  }

  get isOpen(): boolean {
    return (
      OPEN_CONFIG_PULL_REQUEST_STATES as readonly ConfigPullRequestState[]
    ).includes(this.state.state);
  }

  get reason(): ConfigPullRequestReason | null {
    return this.state.reason;
  }

  get retries(): number {
    return this.state.retries;
  }

  get lastCommit(): string | null {
    return this.state.lastCommit;
  }

  get dueAt(): Date | null {
    return this.state.dueAt;
  }

  get createdAt(): Date {
    return this.state.createdAt;
  }

  get updatedAt(): Date {
    return this.state.updatedAt;
  }

  get version(): number {
    return this.state.version;
  }

  isDue(now: Date): boolean {
    return this.state.dueAt !== null && this.state.dueAt <= now;
  }

  claimed(until: Date): ConfigPullRequest {
    this.mustBe('opening', 'closing');

    return this.with({ dueAt: until });
  }

  commit(commit: string, at: Date): ConfigPullRequest {
    this.mustBe('opening');

    return this.with({ lastCommit: commit, updatedAt: at });
  }

  open(opened: OpenedPullRequest, at: Date): ConfigPullRequest {
    this.mustBe('opening');

    const next = this.with({
      state: 'opened',
      repository: opened.repository.value,
      url: opened.url.value,
      number: opened.number,
      gitHubId: opened.gitHubId,
      basedOn: opened.basedOn,
      proposing: opened.proposing,
      checkedAt: at,
      dueAt: null,
      updatedAt: at,
    });
    const { station } = this.state;

    next.record(
      new ConfigPullRequestOpened(
        this.state.id,
        station.workspaceId,
        station.teamId,
        station.stationId,
        opened.proposing,
        opened.url,
        at,
      ),
    );

    return next;
  }

  isStale(live: StationFingerprint | null): boolean {
    const { state, basedOn, proposing } = this.state;

    return (
      state === 'opened' &&
      !(
        live &&
        ((basedOn && live.equals(basedOn)) ||
          (proposing && live.equals(proposing)))
      )
    );
  }

  closeIfStale(live: StationFingerprint | null, at: Date): ConfigPullRequest {
    return this.isStale(live)
      ? this.with({
          state: 'closing',
          closedBecause: 'stale',
          retries: 0,
          dueAt: at,
          updatedAt: at,
        })
      : this;
  }

  closeTried(message: string, at: Date): ConfigPullRequest {
    this.mustBe('closing');

    const retries = this.state.retries + 1;

    return retries >= MAX_RETRIES
      ? this.with({ retries }).closeFailed(
          ConfigPullRequestReason.of({ code: 'github-error', message }),
          at,
        )
      : this.with({
          retries,
          dueAt: new Date(at.getTime() + retryAfterMs(retries)),
          updatedAt: at,
        });
  }

  closeFailed(reason: ConfigPullRequestReason, at: Date): ConfigPullRequest {
    this.mustBe('closing');

    return this.with({ closeFailure: reason }).ended({ merged: false, at });
  }

  closed(at: Date): ConfigPullRequest {
    this.mustBe('closing');

    return this.ended({ merged: false, at });
  }

  recordGitHubClose(close: GitHubClose): ConfigPullRequest {
    const { state } = this.state;

    if (state === 'opened' || state === 'closing') {
      return this.ended(close);
    }

    return state === 'closed' && close.merged ? this.ended(close) : this;
  }

  reopened(at: Date): ConfigPullRequest {
    const { state, closedBecause, proposing, station } = this.state;

    if (state !== 'closed') {
      return this;
    }
    if (!closedBecause || !proposing) {
      throw new InconsistentStateError(
        AGGREGATE,
        'reopens only once it closed',
      );
    }

    const reopened = this.with({
      state: 'opened',
      closedBecause: null,
      closeFailure: null,
      checkedAt: at,
      updatedAt: at,
    });

    reopened.record(
      new ConfigPullRequestReopened(
        this.state.id,
        station.workspaceId,
        station.teamId,
        station.stationId,
        closedBecause,
        proposing,
        at,
      ),
    );

    return reopened;
  }

  checked(at: Date): ConfigPullRequest {
    this.mustBe('opened');

    return this.with({ checkedAt: at });
  }

  private ended(close: GitHubClose): ConfigPullRequest {
    const { station, basedOn, proposing } = this.state;

    if (close.merged) {
      const merged = this.with({
        state: 'merged',
        closedBecause: null,
        closeFailure: null,
        dueAt: null,
        updatedAt: close.at,
      });

      merged.record(
        new ConfigPullRequestMerged(
          this.state.id,
          station.workspaceId,
          station.teamId,
          station.stationId,
          close.at,
        ),
      );

      return merged;
    }

    if (!basedOn || !proposing) {
      throw new InconsistentStateError(AGGREGATE, 'closes only once it opened');
    }

    const because: ConfigPullRequestCloseReason =
      this.state.state === 'closing' ? 'stale' : 'by-person';
    const closed = this.with({
      state: 'closed',
      closedBecause: because,
      dueAt: null,
      updatedAt: close.at,
    });

    closed.record(
      new ConfigPullRequestClosed(
        this.state.id,
        station.workspaceId,
        station.teamId,
        station.stationId,
        because,
        basedOn,
        proposing,
        close.at,
      ),
    );

    return closed;
  }

  failed(reason: ConfigPullRequestReason, at: Date): ConfigPullRequest {
    this.mustBe('opening');

    const failed = this.with({
      state: 'failed',
      reason,
      dueAt: null,
      updatedAt: at,
    });

    failed.record(failed.failureOf(reason));

    return failed;
  }

  tried(message: string, at: Date): ConfigPullRequest {
    this.mustBe('opening');

    const retries = this.state.retries + 1;

    return retries >= MAX_RETRIES
      ? this.with({ retries }).failed(
          ConfigPullRequestReason.of({ code: 'github-error', message }),
          at,
        )
      : this.with({
          retries,
          dueAt: new Date(at.getTime() + retryAfterMs(retries)),
          updatedAt: at,
        });
  }

  delete(): ConfigPullRequest {
    return new ConfigPullRequest(this.state, true);
  }

  private mustBe(...states: readonly ConfigPullRequestState[]): void {
    if (!states.includes(this.state.state)) {
      throw new InconsistentStateError(
        AGGREGATE,
        `is ${this.state.state}, not ${states.join(' or ')}`,
      );
    }
  }

  private failureOf(reason: ConfigPullRequestReason): ConfigPullRequestFailed {
    return new ConfigPullRequestFailed(this.state.id, this.workspaceId, reason);
  }

  private wanted(by: ChangeActor): ConfigPullRequestRequested {
    const changed = {
      resource: 'config-pull-request' as const,
      id: this.state.id.value,
      key: this.state.branch,
    };
    const detail = ConfigPullRequestDetail.of({
      searchId: this.state.searchId.value,
      candidateId: this.state.candidateId.value,
      candidate: this.state.candidateName,
    });

    return new ConfigPullRequestRequested(
      this.state.id,
      this.teamId,
      ConfigurationChange.created(changed, by, detail),
    );
  }

  private with(part: Partial<State>): ConfigPullRequest {
    const next = new ConfigPullRequest({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}
