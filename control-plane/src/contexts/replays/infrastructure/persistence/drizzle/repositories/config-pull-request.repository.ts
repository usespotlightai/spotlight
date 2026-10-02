import { Inject, Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { ConfigPullRequest } from '@replays/domain/aggregates/config-pull-request.aggregate';
import { ConfigPullRequestMovedOnError } from '@replays/domain/exceptions/config-pull-request-moved-on.error';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ConfigPullRequestId } from '@replays/domain/value-objects/config-pull-request-id.vo';
import { ConfigPullRequestReason } from '@replays/domain/value-objects/config-pull-request-reason.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { configPullRequest } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, asc, eq, lte, type SQL } from 'drizzle-orm';

type PullRequestRow = typeof configPullRequest.$inferSelect;

const reasonOf = (row: PullRequestRow): ConfigPullRequestReason | null => {
  if (row.refusal === null) {
    return null;
  }
  if (row.refusalMessage === null) {
    throw new InconsistentStateError(
      'config pull request',
      'was refused without a message',
    );
  }

  return ConfigPullRequestReason.of({
    code: row.refusal,
    message: row.refusalMessage,
    attribute: row.refusalAttribute,
    expression: row.refusalExpression,
    wanted: row.refusalWanted,
  });
};

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
    reason: reasonOf(row),
    attempts: row.attempts,
    tries: row.tries,
    lastCommit: row.lastCommit,
    dueAt: row.dueAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  });

const columnsOf = (held: ConfigPullRequest) => ({
  workspaceId: held.workspaceId.value,
  teamId: held.teamId.value,
  searchId: held.searchId.value,
  candidateId: held.candidateId.value,
  lineId: held.station.lineId,
  stationId: held.station.stationId,
  stationKey: held.stationKey,
  candidateName: held.candidateName,
  repository: held.repository,
  path: held.path,
  branch: held.branch,
  state: held.current,
  url: held.url,
  refusal: held.reason?.code ?? null,
  refusalMessage: held.reason?.message ?? null,
  refusalAttribute: held.reason?.attribute ?? null,
  refusalExpression: held.reason?.expression ?? null,
  refusalWanted: held.reason?.wanted ?? null,
  attempts: held.attempts,
  tries: held.tries,
  lastCommit: held.lastCommit,
  dueAt: held.dueAt,
  createdAt: held.createdAt,
  updatedAt: held.updatedAt,
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

  ofTeam(teamId: TeamId): Promise<readonly ConfigPullRequest[]> {
    return this.where(eq(configPullRequest.teamId, teamId.value));
  }

  due(now: Date): Promise<readonly ConfigPullRequest[]> {
    return this.where(
      and(
        eq(configPullRequest.state, 'opening'),
        lte(configPullRequest.dueAt, now),
      ) as SQL,
    );
  }

  add(added: ConfigPullRequest): Promise<ConfigPullRequest> {
    return this.context.run(async () => {
      const written = await this.context.db
        .insert(configPullRequest)
        .values({
          id: added.id.value,
          ...columnsOf(added),
          version: added.version,
        })
        .onConflictDoNothing({
          target: [configPullRequest.searchId, configPullRequest.candidateId],
        })
        .returning({ id: configPullRequest.id });

      if (written.length === 0) {
        const kept = await this.forCandidate(added.searchId, added.candidateId);

        if (!kept) {
          throw new ConfigPullRequestMovedOnError(added.id.value);
        }

        return kept;
      }

      await this.events.dispatch(added.pullEvents());

      return added;
    });
  }

  async save(saved: ConfigPullRequest): Promise<void> {
    await this.context.run(async () => {
      const at = and(
        eq(configPullRequest.id, saved.id.value),
        eq(configPullRequest.version, saved.version),
      );
      const written = saved.isAbandoned
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
        throw new ConfigPullRequestMovedOnError(saved.id.value);
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
