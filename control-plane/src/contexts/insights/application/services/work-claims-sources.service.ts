import type { CommitPullRequestsPort } from '@insights/application/ports/commit-pull-requests.port';
import type {
  ClaimsSource,
  SourcedStation,
} from '@insights/domain/aggregates/claims-source.aggregate';
import { ClaimsSourceVersionConflictError } from '@insights/domain/exceptions/claims-source-version-conflict.error';
import type { ClaimsSourceRepository } from '@insights/domain/repositories/claims-source.repository';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';

const LOOKED_UP_AT_ONCE = 4;

interface SourceKey {
  readonly station: SourcedStation;
  readonly rubricVersion: RubricVersion;
}

export class WorkClaimsSources implements PendingJobsPort {
  readonly name = 'Finding the pull requests of claims versions';

  readonly #loop: JobLoop<ClaimsSource, SourceKey>;

  constructor(
    private readonly sources: ClaimsSourceRepository,
    private readonly pullRequests: CommitPullRequestsPort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<ClaimsSource, SourceKey>(
      {
        name: this.name,
        batchSize: LOOKED_UP_AT_ONCE,
        due: (now) => this.sources.nextDueJob(now),
        find: (key) =>
          this.sources.find(key.station.stationId, key.rubricVersion),
        save: (source) => this.sources.save(source),
        keyOf: (source) => ({
          station: source.station,
          rubricVersion: source.rubricVersion,
        }),
        ids: (source) => ({
          workspaceId: source.station.workspaceId.value,
          stationId: source.station.stationId.value,
        }),
        about: (source) => ({
          attempts: source.job?.attempts,
          lookups: source.lookups,
        }),
        process: (source) => this.lookedUp(source),
        stale: (error) => error instanceof ClaimsSourceVersionConflictError,
      },
      transaction,
      clock,
      logger,
      reports,
      telemetry,
    );
  }

  processDue(): Promise<void> {
    return this.#loop.processDue();
  }

  idle(): Promise<void> {
    return this.#loop.idle();
  }

  private async lookedUp(source: ClaimsSource): Promise<ClaimsSource> {
    const found = await this.pullRequests.of(
      source.station.workspaceId,
      source.commit,
    );

    return source.mergedBy(found, this.clock.now());
  }
}
