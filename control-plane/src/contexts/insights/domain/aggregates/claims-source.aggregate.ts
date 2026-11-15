import { ClaimsSourceErased } from '@insights/domain/events/claims-source-erased.event';
import { ClaimsSourceRecorded } from '@insights/domain/events/claims-source-recorded.event';
import { ClaimsSourceResolved } from '@insights/domain/events/claims-source-resolved.event';
import { InvalidClaimsSourceError } from '@insights/domain/exceptions/invalid-claims-source.error';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { HasPendingJob } from '@shared-kernel/domain/has-pending-job';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { PendingJob } from '@shared-kernel/domain/value-objects/pending-job.vo';
import type { SourceCommit } from '@shared-kernel/domain/value-objects/source-commit.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const LOOKUP_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000] as const;

const MAX_LOOKUPS = LOOKUP_DELAYS_MS.length + 1;

export interface SourcedStation {
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly lineId: LineId;
  readonly stationId: StationId;
}

export interface SourcePullRequest {
  readonly number: number;
  readonly url: string;
  readonly title: string;
}

export interface CommitPullRequest extends SourcePullRequest {
  readonly merged: boolean;
}

export interface ClaimsSourceFields {
  readonly station: SourcedStation;
  readonly rubricVersion: RubricVersion;
  readonly commit: SourceCommit;
  readonly recordedAt: Date;
  readonly pullRequest: SourcePullRequest | null;
  readonly resolvedAt: Date | null;
  readonly job: PendingJob | null;
  readonly lookups: number;
  readonly version: number;
}

const mergingOf = (
  found: readonly CommitPullRequest[],
): SourcePullRequest | null => {
  const picked = found.find((each) => each.merged) ?? found[0];

  return picked
    ? { number: picked.number, url: picked.url, title: picked.title }
    : null;
};

export class ClaimsSource
  extends EventRecorder
  implements HasPendingJob<ClaimsSource>
{
  private deleted = false;

  private constructor(private readonly fields: ClaimsSourceFields) {
    super();
  }

  static recorded(input: {
    station: SourcedStation;
    rubricVersion: RubricVersion;
    commit: SourceCommit;
    at: Date;
  }): ClaimsSource {
    const recorded = new ClaimsSource({
      station: input.station,
      rubricVersion: input.rubricVersion,
      commit: input.commit,
      recordedAt: input.at,
      pullRequest: null,
      resolvedAt: null,
      job: PendingJob.fresh(),
      lookups: 0,
      version: 0,
    });

    recorded.record(recorded.happened(ClaimsSourceRecorded));

    return recorded;
  }

  static rehydrate(fields: ClaimsSourceFields): ClaimsSource {
    if ((fields.job === null) === (fields.resolvedAt === null)) {
      throw new InconsistentStateError(
        'claims source',
        'looks up its pull request exactly while it is unresolved',
      );
    }
    if (
      !Number.isInteger(fields.lookups) ||
      fields.lookups < 0 ||
      fields.lookups > MAX_LOOKUPS
    ) {
      throw new InconsistentStateError(
        'claims source',
        `looks up its pull request 0 to ${MAX_LOOKUPS} times`,
      );
    }
    if (fields.job !== null && fields.lookups >= MAX_LOOKUPS) {
      throw new InconsistentStateError(
        'claims source',
        'looks up its pull request again only while lookups remain',
      );
    }
    if (fields.pullRequest && fields.resolvedAt === null) {
      throw new InconsistentStateError(
        'claims source',
        'keeps a pull request only once resolved',
      );
    }

    return new ClaimsSource(fields);
  }

  get station(): SourcedStation {
    return this.fields.station;
  }

  get rubricVersion(): RubricVersion {
    return this.fields.rubricVersion;
  }

  get commit(): SourceCommit {
    return this.fields.commit;
  }

  get recordedAt(): Date {
    return this.fields.recordedAt;
  }

  get pullRequest(): SourcePullRequest | null {
    return this.fields.pullRequest;
  }

  get resolvedAt(): Date | null {
    return this.fields.resolvedAt;
  }

  get job(): PendingJob | null {
    return this.fields.job;
  }

  get lookups(): number {
    return this.fields.lookups;
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

  leaseJob(now: Date): ClaimsSource {
    const { job } = this.fields;

    if (!job) {
      throw new InvalidClaimsSourceError('is already resolved');
    }
    if (!job.isDue(now) || job.exhausted) {
      throw new InvalidClaimsSourceError('cannot be looked up yet');
    }

    return this.with({ job: job.lease(now) });
  }

  scheduleRetry(now: Date): ClaimsSource {
    const { job } = this.fields;

    return job ? this.with({ job: job.scheduleRetry(now) }) : this;
  }

  deadLetter(now: Date): ClaimsSource {
    return this.resolved(null, now);
  }

  get isDeleted(): boolean {
    return this.deleted;
  }

  mergedBy(found: readonly CommitPullRequest[], at: Date): ClaimsSource {
    if (this.fields.resolvedAt) {
      return this;
    }

    const lookups = this.fields.lookups + 1;
    const merging = mergingOf(found);
    const delay = LOOKUP_DELAYS_MS[lookups - 1];

    if (merging || delay === undefined) {
      return this.with({ lookups }).resolved(merging, at);
    }

    return this.with({
      lookups,
      job: PendingJob.fresh().scheduleRetryAt(new Date(at.getTime() + delay)),
    });
  }

  delete(): ClaimsSource {
    const deleted = this.with({});

    deleted.deleted = true;
    deleted.record(deleted.happened(ClaimsSourceErased));

    return deleted;
  }

  private resolved(
    pullRequest: SourcePullRequest | null,
    at: Date,
  ): ClaimsSource {
    if (this.fields.resolvedAt) {
      return this;
    }

    const resolved = this.with({ pullRequest, resolvedAt: at, job: null });

    resolved.record(resolved.happened(ClaimsSourceResolved));

    return resolved;
  }

  private with(change: Partial<ClaimsSourceFields>): ClaimsSource {
    const next = new ClaimsSource({ ...this.fields, ...change });

    next.inheritEvents(this);

    return next;
  }

  private happened<E extends DomainEvent>(
    event: new (
      workspaceId: WorkspaceId,
      stationId: StationId,
      rubricVersion: RubricVersion,
    ) => E,
  ): E {
    return new event(
      this.fields.station.workspaceId,
      this.fields.station.stationId,
      this.fields.rubricVersion,
    );
  }
}
