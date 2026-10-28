import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { ConfigPullRequestOpenAtStationError } from '@replays/domain/exceptions/config-pull-request-open-at-station.error';
import { ConfigPullRequestVersionConflictError } from '@replays/domain/exceptions/config-pull-request-version-conflict.error';
import type {
  ConfigPullRequestRepository,
  GitHubPullRequestKey,
} from '@replays/domain/repositories/config-pull-request.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import {
  type ConfigPullRequestState,
  OPEN_CONFIG_PULL_REQUEST_STATES,
} from '@replays/domain/value-objects/config-pull-request-state';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { configPullRequest } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, inArray, lt, lte, type SQL, sql } from 'drizzle-orm';

type PullRequestRow = typeof configPullRequest.$inferSelect;

const reasonOf = (row: PullRequestRow): ConfigPullRequestReason | null => {
  if (row.errorCode === null) {
    return null;
  }
  if (row.errorMessage === null) {
    throw new InconsistentStateError(
      'config pull request',
      'failed without a message',
    );
  }

  return ConfigPullRequestReason.of({
    code: row.errorCode,
    message: row.errorMessage,
    attribute: row.errorAttribute,
    expression: row.errorExpression,
    wanted: row.errorWanted,
  });
};

const closeFailureOf = (row: PullRequestRow): ConfigPullRequestReason | null =>
  row.closeFailureCode === null
    ? null
    : ConfigPullRequestReason.of({
        code: row.closeFailureCode,
        message: row.closeFailureMessage ?? '',
      });

const fingerprintOf = (raw: string | null): StationFingerprint | null =>
  raw === null ? null : StationFingerprint.of(raw);

const toPullRequest = (row: PullRequestRow): ConfigPullRequest =>
  ConfigPullRequest.rehydrate({
    id: ConfigPullRequestId.of(row.id),
    searchId: SearchId.of(row.searchId),
    candidateId: CandidateId.of(row.candidateId),
    station: {
      workspaceId: WorkspaceId.of(row.workspaceId),
      teamId: TeamId.of(row.teamId),
      lineId: row.lineId,
      stationId: row.stationId,
    },
    stationKey: row.stationKey,
    candidateName: row.candidateName,
    repository: row.repository,
    path: row.path,
    branch: row.branch,
    state: row.state,
    url: row.url,
    number: row.number,
    gitHubId: row.gitHubId,
    basedOn: fingerprintOf(row.basedOn),
    proposing: fingerprintOf(row.proposing),
    checkedAt: row.checkedAt,
    closedBecause: row.closedBecause,
    closeFailure: closeFailureOf(row),
    reason: reasonOf(row),
    retries: row.retries,
    lastCommit: row.lastCommit,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  });

const columnsOf = (aggregate: ConfigPullRequest) => ({
  workspaceId: aggregate.workspaceId.value,
  teamId: aggregate.teamId.value,
  searchId: aggregate.searchId.value,
  candidateId: aggregate.candidateId.value,
  lineId: aggregate.station.lineId,
  stationId: aggregate.station.stationId,
  stationKey: aggregate.stationKey,
  candidateName: aggregate.candidateName,
  repository: aggregate.repository,
  path: aggregate.path,
  branch: aggregate.branch,
  state: aggregate.current,
  url: aggregate.url,
  number: aggregate.number,
  gitHubId: aggregate.gitHubId,
  basedOn: aggregate.basedOn?.value ?? null,
  proposing: aggregate.proposing?.value ?? null,
  checkedAt: aggregate.checkedAt,
  closedBecause: aggregate.closedBecause,
  closeFailureCode: aggregate.closeFailure?.code ?? null,
  closeFailureMessage: aggregate.closeFailure?.message ?? null,
  errorCode: aggregate.reason?.code ?? null,
  errorMessage: aggregate.reason?.message ?? null,
  errorAttribute: aggregate.reason?.attribute ?? null,
  errorExpression: aggregate.reason?.expression ?? null,
  errorWanted: aggregate.reason?.wanted ?? null,
  retries: aggregate.retries,
  lastCommit: aggregate.lastCommit,
  dueAt: aggregate.dueAt,
  createdAt: aggregate.createdAt,
  updatedAt: aggregate.updatedAt,
});

@Injectable()
export class DrizzleConfigPullRequestRepository
  implements ConfigPullRequestRepository
{
  constructor(
    private readonly context: DrizzleContext,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly events: DomainEventDispatcher,
  ) {}

  async find(id: ConfigPullRequestId): Promise<ConfigPullRequest | null> {
    const [found] = await this.where(eq(configPullRequest.id, id.value));

    return found ?? null;
  }

  async forCandidate(
    searchId: SearchId,
    candidateId: CandidateId,
  ): Promise<ConfigPullRequest | null> {
    const [found] = await this.where(
      and(
        eq(configPullRequest.searchId, searchId.value),
        eq(configPullRequest.candidateId, candidateId.value),
      ) as SQL,
    );

    return found ?? null;
  }

  ofSearch(searchId: SearchId): Promise<readonly ConfigPullRequest[]> {
    return this.where(eq(configPullRequest.searchId, searchId.value));
  }

  ofSearches(
    searchIds: readonly SearchId[],
  ): Promise<readonly ConfigPullRequest[]> {
    if (searchIds.length === 0) {
      return Promise.resolve([]);
    }

    return this.where(
      inArray(configPullRequest.searchId, [
        ...new Set(searchIds.map((each) => each.value)),
      ]),
    );
  }

  ofTeam(teamId: TeamId): Promise<readonly ConfigPullRequest[]> {
    return this.where(eq(configPullRequest.teamId, teamId.value));
  }

  async openAtStation(stationId: string): Promise<boolean> {
    const [found] = await this.context.db
      .select({ id: configPullRequest.id })
      .from(configPullRequest)
      .where(
        and(
          eq(configPullRequest.stationId, stationId),
          inArray(configPullRequest.state, [
            ...OPEN_CONFIG_PULL_REQUEST_STATES,
          ]),
        ),
      )
      .limit(1);

    return found !== undefined;
  }

  due(
    state: Extract<ConfigPullRequestState, 'opening' | 'closing'>,
    now: Date,
  ): Promise<readonly ConfigPullRequest[]> {
    return this.where(
      and(
        eq(configPullRequest.state, state),
        lte(configPullRequest.dueAt, now),
      ) as SQL,
    );
  }

  async fromGitHub(
    workspaceId: WorkspaceId,
    pullRequest: GitHubPullRequestKey,
  ): Promise<ConfigPullRequest | null> {
    const [found] = await this.where(
      and(
        eq(configPullRequest.workspaceId, workspaceId.value),
        pullRequest.gitHubId === null
          ? and(
              eq(
                sql`lower(${configPullRequest.repository})`,
                pullRequest.repository.toLowerCase(),
              ),
              eq(configPullRequest.number, pullRequest.number),
            )
          : eq(configPullRequest.gitHubId, pullRequest.gitHubId),
      ) as SQL,
    );

    return found ?? null;
  }

  async dueForCheck(
    checkedBefore: Date,
    limit: number,
  ): Promise<readonly ConfigPullRequest[]> {
    return (
      await this.context.db
        .select()
        .from(configPullRequest)
        .where(
          and(
            eq(configPullRequest.state, 'opened'),
            lt(configPullRequest.checkedAt, checkedBefore),
          ),
        )
        .orderBy(asc(configPullRequest.checkedAt), asc(configPullRequest.id))
        .limit(limit)
    ).map(toPullRequest);
  }

  openedOnLine(lineId: string): Promise<readonly ConfigPullRequest[]> {
    return this.where(
      and(
        eq(configPullRequest.lineId, lineId),
        eq(configPullRequest.state, 'opened'),
      ) as SQL,
    );
  }

  add(added: ConfigPullRequest): Promise<ConfigPullRequest> {
    return this.context.inTransaction(async () => {
      const written = await this.context.db
        .insert(configPullRequest)
        .values({
          id: added.id.value,
          ...columnsOf(added),
          version: added.version,
        })
        .onConflictDoNothing()
        .returning({ id: configPullRequest.id });

      if (written.length === 0) {
        const existing = await this.forCandidate(
          added.searchId,
          added.candidateId,
        );

        if (!existing && added.isOpen) {
          throw new ConfigPullRequestOpenAtStationError(
            added.station.stationId,
          );
        }
        if (!existing) {
          throw new ConfigPullRequestVersionConflictError(added.id.value);
        }

        return existing;
      }

      await this.events.dispatch(added.pullEvents());

      return added;
    });
  }

  async save(saved: ConfigPullRequest): Promise<void> {
    await this.context.inTransaction(async () => {
      const at = and(
        eq(configPullRequest.id, saved.id.value),
        eq(configPullRequest.version, saved.version),
      );
      const written = saved.isDeleted
        ? await this.context.db
            .delete(configPullRequest)
            .where(at)
            .returning({ id: configPullRequest.id })
        : await this.context.db
            .update(configPullRequest)
            .set({ ...columnsOf(saved), version: saved.version + 1 })
            .where(at)
            .returning({ id: configPullRequest.id });

      if (written.length === 0) {
        throw new ConfigPullRequestVersionConflictError(saved.id.value);
      }

      await this.events.dispatch(saved.pullEvents());
    });
  }

  private async where(where: SQL): Promise<readonly ConfigPullRequest[]> {
    return (
      await this.context.db
        .select()
        .from(configPullRequest)
        .where(where)
        .orderBy(asc(configPullRequest.createdAt), asc(configPullRequest.id))
    ).map(toPullRequest);
  }
}
