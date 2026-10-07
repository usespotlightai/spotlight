import type { ReplayedStation } from '@replays/domain/aggregates/replay-set.aggregate';
import { ConfigPullRequestOpened } from '@replays/domain/events/config-pull-request-opened.event';
import { ConfigPullRequestWanted } from '@replays/domain/events/config-pull-request-wanted.event';
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
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const MOST_TRIES = 5;

const FIRST_RETRY_MS = 30_000;

const RETRY_GROWTH = 4;

const retryAfterMs = (tries: number): number =>
  FIRST_RETRY_MS * RETRY_GROWTH ** (tries - 1);

const HOLDER = 'config pull request';

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
  readonly attempts: number;
  readonly tries: number;
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
    readonly isAbandoned = false,
  ) {
    super();
  }

  static branchFor(searchId: SearchId, candidateName: string): string {
    return `spotlight/search-${searchId.value.slice(0, SEARCH_PREFIX)}-${slugOf(candidateName)}`;
  }

  static picked(input: {
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
        HOLDER,
        'has a pull request link when, and only when, it opened',
      );
    }
    if ((current === 'refused') !== (reason !== null)) {
      throw new InconsistentStateError(
        HOLDER,
        'says why when, and only when, it was refused',
      );
    }
    if (current !== 'refused' && (repository === null || path === null)) {
      throw new InconsistentStateError(
        HOLDER,
        'knows the repository and file it opens against unless it was refused',
      );
    }
    if ((current === 'opening') !== (state.dueAt !== null)) {
      throw new InconsistentStateError(
        HOLDER,
        'is due to be tried when, and only when, it is opening',
      );
    }
    if (!Number.isInteger(state.attempts) || state.attempts < 1) {
      throw new InconsistentStateError(
        HOLDER,
        `counts ${state.attempts} attempts, not one or more`,
      );
    }

    return new ConfigPullRequest(state);
  }

  private static attempted(
    source: ConfigSourceOf | null,
    lineKey: string,
    attempts: number,
    at: Date,
  ): Pick<
    State,
    | 'repository'
    | 'path'
    | 'state'
    | 'url'
    | 'reason'
    | 'attempts'
    | 'tries'
    | 'dueAt'
    | 'updatedAt'
  > {
    return {
      repository: source?.repository.value ?? null,
      path: source?.path ?? null,
      state: source ? 'opening' : 'refused',
      url: null,
      reason: source ? null : ConfigPullRequestReason.noSource(lineKey),
      attempts,
      tries: 0,
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

  get attempts(): number {
    return this.state.attempts;
  }

  get tries(): number {
    return this.state.tries;
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
    return this.state.state === 'refused';
  }

  isOpening(attempt: number): boolean {
    return this.state.state === 'opening' && this.state.attempts === attempt;
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
        HOLDER,
        `is ${this.state.state}, and only a refused one is tried again`,
      );
    }

    const retried = this.with(
      ConfigPullRequest.attempted(
        input.source,
        input.lineKey,
        this.state.attempts + 1,
        input.at,
      ),
    );

    retried.record(retried.wanted('updated', input.by));

    return retried;
  }

  committed(commit: string, at: Date): ConfigPullRequest {
    this.mustBeOpening();

    return this.with({ lastCommit: commit, updatedAt: at });
  }

  opened(
    url: string,
    proposing: StationFingerprint,
    at: Date,
  ): ConfigPullRequest {
    this.mustBeOpening();

    const opened = this.with({
      state: 'opened',
      url,
      dueAt: null,
      updatedAt: at,
    });
    const { station } = this.state;

    opened.record(
      new ConfigPullRequestOpened(
        this.state.id,
        station.workspaceId,
        station.teamId,
        station.lineId,
        station.stationId,
        proposing,
        url,
        at,
      ),
    );

    return opened;
  }

  refused(reason: ConfigPullRequestReason, at: Date): ConfigPullRequest {
    this.mustBeOpening();

    return this.with({ state: 'refused', reason, dueAt: null, updatedAt: at });
  }

  tried(message: string, at: Date): ConfigPullRequest {
    this.mustBeOpening();

    const tries = this.state.tries + 1;

    return tries >= MOST_TRIES
      ? this.with({ tries }).refused(
          ConfigPullRequestReason.of({ code: 'github-refused', message }),
          at,
        )
      : this.with({
          tries,
          dueAt: new Date(at.getTime() + retryAfterMs(tries)),
          updatedAt: at,
        });
  }

  abandoned(): ConfigPullRequest {
    return new ConfigPullRequest(this.state, true);
  }

  private mustBeOpening(): void {
    if (this.state.state !== 'opening') {
      throw new InconsistentStateError(
        HOLDER,
        `is ${this.state.state}, not opening`,
      );
    }
  }

  private wanted(
    action: 'created' | 'updated',
    by: Attribution,
  ): ConfigPullRequestWanted {
    const changed = {
      resource: 'config-pull-request' as const,
      id: this.state.id.value,
      key: this.state.branch,
    };
    const detail = ConfigPullRequestDetail.of({
      searchId: this.state.searchId.value,
      candidateId: this.state.candidateId.value,
      candidate: this.state.candidateName,
      attempt: this.state.attempts,
    });

    return new ConfigPullRequestWanted(
      this.state.id,
      this.teamId,
      this.state.attempts,
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
