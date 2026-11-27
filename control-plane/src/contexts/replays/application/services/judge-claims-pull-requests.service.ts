import { ConfigRepositoryError } from '@replays/application/errors/config-repository.error';
import type { ConfigRepositoryPort } from '@replays/application/ports/config-repository.port';
import type { LinesPort } from '@replays/application/ports/lines.port';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { StationSourceEditorPort } from '@replays/application/ports/station-source-editor.port';
import {
  JudgeClaimsPullRequestBody,
  type JudgeClaimsPullRequestFacts,
} from '@replays/application/rendering/judge-claims-pull-request-body';
import type { JudgeClaimsPullRequest } from '@replays/domain/aggregates/judge-claims-pull-request.aggregate';
import { JudgeClaimsPullRequestVersionConflictError } from '@replays/domain/exceptions/judge-claims-pull-request-version-conflict.error';
import type { JudgeClaimsPullRequestRepository } from '@replays/domain/repositories/judge-claims-pull-request.repository';
import { isBlock } from '@replays/domain/value-objects/block-shape';
import { CommitSha } from '@replays/domain/value-objects/commit-sha.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const REVISION_PREFIX = 8;

const MAX_OPENED_AT_ONCE = 1;

type ConfigSource = NonNullable<
  NonNullable<Awaited<ReturnType<LinesPort['station']>>>['source']
>;

export type JudgeClaimsProposed =
  | { readonly opened: true; readonly url: string }
  | { readonly opened: false; readonly reason: string };

const failed = (reason: string): JudgeClaimsProposed => ({
  opened: false,
  reason,
});

const slugOf = (key: string): string =>
  key
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'station';

const sameClaims = (
  stored: unknown,
  claims: readonly string[],
): stored is readonly string[] =>
  Array.isArray(stored) &&
  stored.length === claims.length &&
  stored.every(
    (each, at) => typeof each === 'string' && each.trim() === claims[at],
  );

export const judgeClaimsBranchOf = (input: {
  lineKey: string;
  stationKey: string;
  revisionId: string;
}): string =>
  `spotlight/claims-${slugOf(input.lineKey)}-${slugOf(input.stationKey)}-${input.revisionId.slice(0, REVISION_PREFIX)}`;

export interface JudgeClaimsPullRequestSources {
  readonly pullRequests: JudgeClaimsPullRequestRepository;
  readonly lines: LinesPort;
  readonly people: PeoplePort;
  readonly configs: ConfigRepositoryPort;
  readonly editor: StationSourceEditorPort;
}

export class OpenJudgeClaimsPullRequests implements PendingJobsPort {
  readonly name = 'Opening judge claims pull requests';

  readonly #loop: JobLoop<JudgeClaimsPullRequest, string>;

  constructor(
    private readonly sources: JudgeClaimsPullRequestSources,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<JudgeClaimsPullRequest, string>(
      {
        name: this.name,
        batchSize: MAX_OPENED_AT_ONCE,
        due: (now) => this.sources.pullRequests.nextDueJob(now),
        find: (revisionId) => this.sources.pullRequests.find(revisionId),
        save: (pullRequest) => this.sources.pullRequests.save(pullRequest),
        keyOf: (pullRequest) => pullRequest.revisionId,
        ids: (pullRequest) => ({
          workspaceId: pullRequest.station.workspaceId.value,
          stationId: pullRequest.station.stationId.value,
        }),
        about: (pullRequest) => ({
          attempts: pullRequest.job?.attempts,
          trigger: pullRequest.proposal.trigger,
        }),
        process: (pullRequest) => this.attempted(pullRequest),
        stale: (error) =>
          error instanceof JudgeClaimsPullRequestVersionConflictError,
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

  private async attempted(
    pullRequest: JudgeClaimsPullRequest,
  ): Promise<JudgeClaimsPullRequest> {
    let latest = pullRequest;
    const proposed = await this.proposed(pullRequest, async (commit) => {
      latest = await this.saved(
        latest.committed(CommitSha.of(commit), this.clock.now()),
      );
    });

    return proposed.opened
      ? latest.opened(proposed.url, this.clock.now())
      : latest.failed(proposed.reason, this.clock.now());
  }

  private async saved(
    pullRequest: JudgeClaimsPullRequest,
  ): Promise<JudgeClaimsPullRequest> {
    await this.sources.pullRequests.save(pullRequest);

    const found = await this.sources.pullRequests.find(pullRequest.revisionId);

    if (!found) {
      throw new JudgeClaimsPullRequestVersionConflictError(
        pullRequest.revisionId,
      );
    }

    return found;
  }

  private async proposed(
    pullRequest: JudgeClaimsPullRequest,
    committed: (commit: string) => Promise<void>,
  ): Promise<JudgeClaimsProposed> {
    const { station: at, proposal } = pullRequest;
    const [station, settings, teamKey] = await Promise.all([
      this.sources.lines.station(at.lineId, at.stationId),
      this.sources.lines.stationSettings(at.lineId, at.stationId),
      this.sources.people.teamKey(at.teamId),
    ]);

    if (!station || !settings || teamKey === null || teamKey === '') {
      return failed('The station is gone from its line.');
    }
    if (!station.source) {
      return failed(ConfigPullRequestReason.noSource(station.lineKey).message);
    }

    const seed = settings.block;
    const judge = seed.value.judge;

    if (!isBlock(judge) || !sameClaims(judge.claims, proposal.claimsBefore)) {
      return failed(
        'The judge claims of the station changed after the revision started.',
      );
    }

    try {
      return await this.opened(pullRequest, committed, {
        workspaceId: at.workspaceId,
        source: station.source,
        lineKey: station.lineKey,
        stationKey: station.key,
        teamKey,
        seed,
        candidate: StationBlock.of({
          ...seed.value,
          judge: { ...judge, claims: [...proposal.claimsAfter] },
        }),
      });
    } catch (error) {
      if (error instanceof ConfigRepositoryError) {
        return failed(error.message);
      }
      throw error;
    }
  }

  private async opened(
    pullRequest: JudgeClaimsPullRequest,
    committed: (commit: string) => Promise<void>,
    edit: {
      workspaceId: WorkspaceId;
      source: ConfigSource;
      lineKey: string;
      stationKey: string;
      teamKey: string;
      seed: StationBlock;
      candidate: StationBlock;
    },
  ): Promise<JudgeClaimsProposed> {
    const { repository, path } = edit.source;
    const { configs, editor } = this.sources;
    const file = await configs.fileAt(edit.workspaceId, repository, path);

    if (!file) {
      return failed(
        `File ${path} not found on the default branch of ${repository.value}.`,
      );
    }

    const configFiles = (
      await configs.filesUnder(
        edit.workspaceId,
        repository,
        path.slice(0, Math.max(path.lastIndexOf('/'), 0)),
        file.commit,
      )
    ).filter((each) => each.path !== path);
    const edited = await editor.edited({
      file: { path, content: file.content },
      teamKey: edit.teamKey,
      lineKey: edit.lineKey,
      stationKey: edit.stationKey,
      seed: edit.seed,
      candidate: edit.candidate,
      configFiles,
    });

    if (!edited.ok) {
      return failed(edited.reason.message);
    }

    const facts: JudgeClaimsPullRequestFacts = {
      ...pullRequest.proposal,
      lineKey: edit.lineKey,
      stationKey: edit.stationKey,
    };
    const title = JudgeClaimsPullRequestBody.titleOf(facts);
    const branch = judgeClaimsBranchOf({
      lineKey: edit.lineKey,
      stationKey: edit.stationKey,
      revisionId: pullRequest.revisionId,
    });

    await committed(
      await configs.committed(edit.workspaceId, repository, {
        branch,
        base: file.commit,
        replacing: pullRequest.lastCommit,
        message: `${title}\n\nDrafted by a Spotlight claims revision of the ${edit.stationKey} station.`,
        files: edited.files,
      }),
    );

    const { url } = await configs.opened(edit.workspaceId, repository, {
      branch,
      title,
      body: JudgeClaimsPullRequestBody.of(facts),
    });

    return { opened: true, url };
  }
}
