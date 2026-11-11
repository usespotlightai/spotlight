import type {
  ConfigPullRequestStation,
  StationConfigPullRequestsPort,
} from '@insights/application/ports/station-config-pull-requests.port';
import { Injectable } from '@nestjs/common';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { configPullRequest } from '@replays/infrastructure/persistence/drizzle/schemas/replays.schema';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

@Injectable()
export class DrizzleStationConfigPullRequests
  implements StationConfigPullRequestsPort
{
  constructor(private readonly context: DrizzleContext) {}

  async newestFor(
    station: ConfigPullRequestStation,
    fingerprints: readonly string[],
  ): Promise<ReadonlyMap<string, PullRequestUrl>> {
    if (fingerprints.length === 0) {
      return new Map();
    }

    const rows = await this.context.db
      .selectDistinctOn([configPullRequest.proposing], {
        fingerprint: configPullRequest.proposing,
        url: configPullRequest.url,
      })
      .from(configPullRequest)
      .where(
        and(
          eq(configPullRequest.workspaceId, station.workspaceId.value),
          eq(configPullRequest.teamId, station.teamId.value),
          eq(configPullRequest.stationId, station.stationId.value),
          isNotNull(configPullRequest.url),
          inArray(configPullRequest.proposing, [...fingerprints]),
        ),
      )
      .orderBy(
        configPullRequest.proposing,
        desc(configPullRequest.createdAt),
        desc(configPullRequest.id),
      );

    return new Map(
      rows.flatMap((row) =>
        row.fingerprint && row.url
          ? [[row.fingerprint, PullRequestUrl.of(row.url)] as const]
          : [],
      ),
    );
  }
}
