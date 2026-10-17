import type { ReplayCheckSummaryDto } from '@replays/application/dto/replay-checks.dto';
import type { PeoplePort } from '@replays/application/ports/people.port';
import type { ListSetReplayChecksQuery } from '@replays/application/queries/list-set-replay-checks.query';
import type { CheckReadings } from '@replays/application/services/check-readings.service';
import { replayUrlOf } from '@replays/application/services/replay-check-views';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import type { ReplayCheckRepository } from '@replays/domain/repositories/replay-check.repository';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class ListSetReplayChecksHandler
  implements
    QueryHandlerPort<ListSetReplayChecksQuery, readonly ReplayCheckSummaryDto[]>
{
  constructor(
    private readonly access: ReplaysAccess,
    private readonly people: PeoplePort,
    private readonly checks: ReplayCheckRepository,
    private readonly readings: CheckReadings,
    private readonly webOrigin: string,
  ) {}

  async execute(
    query: ListSetReplayChecksQuery,
  ): Promise<readonly ReplayCheckSummaryDto[]> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const set = await this.access.setOn(access, query.setId);
      const [page, slug] = await Promise.all([
        this.checks.pageOfSet(set.id, {
          before: query.page.before
            ? ReplayCheckId.of(query.page.before)
            : null,
          limit: query.page.limit,
        }),
        this.people.workspaceSlug(set.workspaceId),
      ]);

      return await Promise.all(
        page.map(async (check) => {
          const { reading } = await this.readings.of(check);

          return {
            id: check.id.value,
            stationId: check.station.stationId,
            stationKey: check.stationKey,
            verdict: reading.verdict,
            undecidedBecause: reading.because,
            regressions: reading.regressions.length,
            attempt: check.attempt,
            reference: {
              commit: check.reference.commit,
              pullRequest: check.reference.pullRequest,
            },
            createdAt: check.createdAt.toISOString(),
            replayUrl: replayUrlOf(this.webOrigin, slug, check),
          };
        }),
      );
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
