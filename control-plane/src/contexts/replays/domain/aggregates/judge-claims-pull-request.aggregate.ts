import { JudgeClaimsPullRequestFailed } from '@replays/domain/events/judge-claims-pull-request-failed.event';
import { JudgeClaimsPullRequestOpened } from '@replays/domain/events/judge-claims-pull-request-opened.event';
import { InvalidJudgeClaimsPullRequestError } from '@replays/domain/exceptions/invalid-judge-claims-pull-request.error';
import type { CommitSha } from '@replays/domain/value-objects/commit-sha.vo';
import type { JudgeClaimsProposal } from '@replays/domain/value-objects/judge-claims-proposal';
import type { JudgeClaimsPullRequestState } from '@replays/domain/value-objects/judge-claims-pull-request-state';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface ProposedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
}

interface JudgeClaimsPullRequestFields {
  readonly revisionId: string;
  readonly station: ProposedStation;
  readonly proposal: JudgeClaimsProposal;
  readonly state: JudgeClaimsPullRequestState;
  readonly job: PendingJob | null;
  readonly lastCommit: CommitSha | null;
  readonly url: string | null;
  readonly reason: string | null;
  readonly requestedAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

const OUT_OF_TRIES =
  'Spotlight could not open the pull request after several tries.';

export class JudgeClaimsPullRequest
  extends EventRecorder
  implements HasPendingJob<JudgeClaimsPullRequest>
{
  private deleted = false;

  private constructor(private readonly fields: JudgeClaimsPullRequestFields) {
    super();
  }

  static requested(input: {
    revisionId: string;
    station: ProposedStation;
    proposal: JudgeClaimsProposal;
    now: Date;
  }): JudgeClaimsPullRequest {
    if (!input.revisionId.trim()) {
      throw new InvalidJudgeClaimsPullRequestError(
        'names the revision that picked its claims',
      );
    }
    if (input.proposal.claimsAfter.length === 0) {
      throw new InvalidJudgeClaimsPullRequestError('proposes claims');
    }

    return new JudgeClaimsPullRequest({
      revisionId: input.revisionId,
      station: input.station,
      proposal: input.proposal,
      state: 'opening',
      job: PendingJob.fresh(),
      lastCommit: null,
      url: null,
      reason: null,
      requestedAt: input.now,
      updatedAt: input.now,
      version: 0,
    });
  }

  static rehydrate(
    fields: JudgeClaimsPullRequestFields,
  ): JudgeClaimsPullRequest {
    if (
      (fields.state === 'opening') !== (fields.job !== null) ||
      (fields.state === 'opened') !== (fields.url !== null) ||
      (fields.state === 'failed') !== (fields.reason !== null)
    ) {
      throw new InconsistentStateError(
        'judge claims pull request',
        'has a job while it opens, a link once opened and a reason once failed',
      );
    }

    return new JudgeClaimsPullRequest(fields);
  }

  get revisionId(): string {
    return this.fields.revisionId;
  }

  get station(): ProposedStation {
    return this.fields.station;
  }

  get proposal(): JudgeClaimsProposal {
    return this.fields.proposal;
  }

  get state(): JudgeClaimsPullRequestState {
    return this.fields.state;
  }

  get job(): PendingJob | null {
    return this.fields.job;
  }

  get lastCommit(): CommitSha | null {
    return this.fields.lastCommit;
  }

  get url(): string | null {
    return this.fields.url;
  }

  get reason(): string | null {
    return this.fields.reason;
  }

  get requestedAt(): Date {
    return this.fields.requestedAt;
  }

  get updatedAt(): Date {
    return this.fields.updatedAt;
  }

  get version(): number {
    return this.fields.version;
  }

  get hasPendingJob(): boolean {
    return this.fields.job !== null;
  }

  get jobExhausted(): boolean {
    return this.fields.job?.exhausted ?? false;
  }

  leaseJob(now: Date): JudgeClaimsPullRequest {
    const { job } = this.fields;

    if (!job || !job.isDue(now) || job.exhausted) {
      throw new InvalidJudgeClaimsPullRequestError('is not due to be opened');
    }

    return this.with({ job: job.lease(now), updatedAt: now });
  }

  scheduleRetry(now: Date): JudgeClaimsPullRequest {
    const { job } = this.fields;

    return job
      ? this.with({ job: job.scheduleRetry(now), updatedAt: now })
      : this;
  }

  waitJob(now: Date): JudgeClaimsPullRequest {
    return this.job
      ? this.with({ job: this.job.wait(now), updatedAt: now })
      : this;
  }

  deadLetter(now: Date): JudgeClaimsPullRequest {
    return this.failed(OUT_OF_TRIES, now);
  }

  committed(commit: CommitSha, now: Date): JudgeClaimsPullRequest {
    if (this.fields.state !== 'opening') {
      throw new InvalidJudgeClaimsPullRequestError(
        'commits only while it opens',
      );
    }

    return this.with({ lastCommit: commit, updatedAt: now });
  }

  opened(url: string, now: Date): JudgeClaimsPullRequest {
    if (this.fields.state !== 'opening') {
      return this;
    }
    if (!url.trim()) {
      throw new InvalidJudgeClaimsPullRequestError('opens with a link');
    }

    const next = this.with({ state: 'opened', job: null, url, updatedAt: now });
    next.record(
      new JudgeClaimsPullRequestOpened(
        this.fields.revisionId,
        this.fields.station.workspaceId,
        url,
      ),
    );

    return next;
  }

  failed(reason: string, now: Date): JudgeClaimsPullRequest {
    if (this.fields.state !== 'opening') {
      return this;
    }

    const said = reason.trim() || OUT_OF_TRIES;
    const next = this.with({
      state: 'failed',
      job: null,
      reason: said,
      updatedAt: now,
    });
    next.record(
      new JudgeClaimsPullRequestFailed(
        this.fields.revisionId,
        this.fields.station.workspaceId,
        said,
      ),
    );

    return next;
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  delete(): JudgeClaimsPullRequest {
    const deleted = this.with({});
    deleted.deleted = true;
    return deleted;
  }

  private with(
    change: Partial<JudgeClaimsPullRequestFields>,
  ): JudgeClaimsPullRequest {
    const next = new JudgeClaimsPullRequest({ ...this.fields, ...change });
    next.inheritEvents(this);
    return next;
  }
}
