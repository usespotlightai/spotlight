import { Injectable } from '@nestjs/common';
import type {
  ConfigPullRequestStation,
  StationConfigPullRequest,
  StationConfigPullRequestsPort,
} from '@outcomes/application/ports/station-config-pull-requests.port';
import { stationConfigPullRequest } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { and, desc, eq, inArray } from 'drizzle-orm';

@Injectable()
export class DrizzleStationConfigPullRequests
  implements StationConfigPullRequestsPort
{
  constructor(private readonly context: DrizzleContext) {}

  async note(pullRequest: StationConfigPullRequest): Promise<void> {
    await this.context.db
      .insert(stationConfigPullRequest)
      .values({
        configPullRequestId: pullRequest.configPullRequestId,
        workspaceId: pullRequest.workspaceId.value,
        teamId: pullRequest.teamId.value,
        stationId: pullRequest.stationId,
        fingerprint: pullRequest.fingerprint,
        url: pullRequest.url.value,
        openedAt: pullRequest.openedAt,
      })
      .onConflictDoNothing({
        target: stationConfigPullRequest.configPullRequestId,
      });
  }

  async newestFor(
    station: ConfigPullRequestStation,
    fingerprints: readonly string[],
  ): Promise<ReadonlyMap<string, PullRequestUrl>> {
    if (fingerprints.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .selectDistinctOn([stationConfigPullRequest.fingerprint], {
        fingerprint: stationConfigPullRequest.fingerprint,
        url: stationConfigPullRequest.url,
      })
      .from(stationConfigPullRequest)
      .where(
        and(
          eq(stationConfigPullRequest.workspaceId, station.workspaceId.value),
          eq(stationConfigPullRequest.teamId, station.teamId.value),
          eq(stationConfigPullRequest.stationId, station.stationId),
          inArray(stationConfigPullRequest.fingerprint, [...fingerprints]),
        ),
      )
      .orderBy(
        stationConfigPullRequest.fingerprint,
        desc(stationConfigPullRequest.openedAt),
        desc(stationConfigPullRequest.configPullRequestId),
      );

    return new Map(
      rows.map((row) => [row.fingerprint, PullRequestUrl.of(row.url)]),
    );
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    await this.context.db
      .delete(stationConfigPullRequest)
      .where(
        and(
          eq(stationConfigPullRequest.workspaceId, workspaceId.value),
          eq(stationConfigPullRequest.teamId, teamId.value),
        ),
      );
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    await this.context.db
      .delete(stationConfigPullRequest)
      .where(eq(stationConfigPullRequest.workspaceId, workspaceId.value));
  }
}
