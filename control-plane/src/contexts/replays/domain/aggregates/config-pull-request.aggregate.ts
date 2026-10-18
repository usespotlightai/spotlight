import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestRequested } from '@replays/domain/events/config-pull-request-requested.event';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestDetail } from '@replays/domain/value-objects/config-pull-request-detail.vo';
import type { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import type { ConfigPullRequestState } from '@replays/domain/value-objects/config-pull-request-state';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MAX_RETRIES = 5;

const FIRST_RETRY_MS = 30_000;

const RETRY_GROWTH = 4;

const retryAfterMs = (retries: number): number =>
  FIRST_RETRY_MS * RETRY_GROWTH ** (retries - 1);

const AGGREGATE = 'config pull request';

const SEARCH_PREFIX = 8;

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
  readonly reason: ConfigPullRequestReason | null;
  readonly generation: number;
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
    by: Attribution;
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
      ...ConfigPullRequest.attempted(input.source, input.lineKey, 1, input.at),
    });

    picked.record(picked.wanted('created', input.by));

    return picked;
  }

  static rehydrate(state: State): ConfigPullRequest {
    const { state: current, url, reason, repository, path } = state;

    if ((current === 'opened') !== (url !== null)) {
      throw new InconsistentStateError(
        AGGREGATE,
        'has a pull request link when, and only when, it opened',
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
    if ((current === 'opening') !== (state.dueAt !== null)) {
      throw new InconsistentStateError(
        AGGREGATE,
        'is due to be tried when, and only when, it is opening',
      );
    }
    if (!Number.isInteger(state.generation) || state.generation < 1) {
      throw new InconsistentStateError(
        AGGREGATE,
        `has generation ${state.generation}, not 1 or more`,
      );
    }

    return new ConfigPullRequest(state);
  }

  private static attempted(
    source: ConfigSourceOf | null,
    lineKey: string,
    generation: number,
    at: Date,
  ): Pick<
    State,
    | 'repository'
    | 'path'
    | 'state'
    | 'url'
    | 'reason'
    | 'generation'
    | 'retries'
    | 'dueAt'
    | 'updatedAt'
  > {
    return {
      repository: source?.repository.value ?? null,
      path: source?.path ?? null,
      state: source ? 'opening' : 'failed',
      url: null,
      reason: source ? null : ConfigPullRequestReason.noSource(lineKey),
      generation,
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

  get reason(): ConfigPullRequestReason | null {
    return this.state.reason;
  }

  get generation(): number {
    return this.state.generation;
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

  get isRetryable(): boolean {
    return this.state.state === 'failed';
  }

  isOpening(generation: number): boolean {
    return (
      this.state.state === 'opening' && this.state.generation === generation
    );
  }

  isDue(now: Date): boolean {
    return this.state.dueAt !== null && this.state.dueAt <= now;
  }

  claimed(until: Date): ConfigPullRequest {
    this.mustBeOpening();

    return this.with({ dueAt: until });
  }

  retried(input: {
    lineKey: string;
    source: ConfigSourceOf | null;
    at: Date;
    by: Attribution;
  }): ConfigPullRequest {
    if (!this.isRetryable) {
      throw new InconsistentStateError(
        AGGREGATE,
        `is ${this.state.state}, and only a failed one is tried again`,
      );
    }

    const retried = this.with(
      ConfigPullRequest.attempted(
        input.source,
        input.lineKey,
        this.state.generation + 1,
        input.at,
      ),
    );

    retried.record(retried.wanted('updated', input.by));

    return retried;
  }

  commit(commit: string, at: Date): ConfigPullRequest {
    this.mustBeOpening();

    return this.with({ lastCommit: commit, updatedAt: at });
  }

  open(
    url: PullRequestUrl,
    proposing: StationFingerprint,
    at: Date,
  ): ConfigPullRequest {
    this.mustBeOpening();

    const opened = this.with({
      state: 'opened',
      url: url.value,
      dueAt: null,
      updatedAt: at,
    });
    const { station } = this.state;

    opened.record(
      new ConfigPullRequestOpened(
        this.state.id,
        station.workspaceId,
        station.teamId,
        station.stationId,
        proposing,
        url,
        at,
      ),
    );

    return opened;
  }

  failed(reason: ConfigPullRequestReason, at: Date): ConfigPullRequest {
    this.mustBeOpening();

    return this.with({ state: 'failed', reason, dueAt: null, updatedAt: at });
  }

  tried(message: string, at: Date): ConfigPullRequest {
    this.mustBeOpening();

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

  private mustBeOpening(): void {
    if (this.state.state !== 'opening') {
      throw new InconsistentStateError(
        AGGREGATE,
        `is ${this.state.state}, not opening`,
      );
    }
  }

  private wanted(
    action: 'created' | 'updated',
    by: Attribution,
  ): ConfigPullRequestRequested {
    const changed = {
      resource: 'config-pull-request' as const,
      id: this.state.id.value,
      key: this.state.branch,
    };
    const detail = ConfigPullRequestDetail.of({
      searchId: this.state.searchId.value,
      candidateId: this.state.candidateId.value,
      candidate: this.state.candidateName,
      generation: this.state.generation,
    });

    return new ConfigPullRequestRequested(
      this.state.id,
      this.teamId,
      this.state.generation,
      action === 'created'
        ? ConfigurationChange.created(changed, by, detail)
        : ConfigurationChange.updated(changed, by, detail),
    );
  }

  private with(part: Partial<State>): ConfigPullRequest {
    const next = new ConfigPullRequest({ ...this.state, ...part });

    next.inheritEvents(this);

    return next;
  }
}
