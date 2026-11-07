import type { SearchViewDto } from '@replays/application/dto/search-view.dto';
import type { StationHistoryPort } from '@replays/application/ports/station-history.port';
import type { WorkPort } from '@replays/application/ports/work.port';
import type { ReadSearchViewQuery } from '@replays/application/queries/read-search-view.query';
import type { SearchVisibilities } from '@replays/application/queries/search-visibilities';
import type { SearchRunDispatching } from '@replays/application/services/search-run-dispatch.service';
import { SearchRunNotActiveError } from '@replays/domain/exceptions/search-run-not-active.error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export class ReadSearchViewHandler
  implements QueryHandlerPort<ReadSearchViewQuery, SearchViewDto>
{
  constructor(
    private readonly searchRuns: SearchRunDispatching,
    private readonly visibilities: SearchVisibilities,
    private readonly work: WorkPort,
    private readonly history: StationHistoryPort,
  ) {}

  async execute(query: ReadSearchViewQuery): Promise<SearchViewDto> {
    try {
      const leased = await this.searchRuns.leasedSearchRun(
        RunId.of(query.runId),
        query.runnerId,
      );

      if (!leased) {
        throw new SearchRunNotActiveError();
      }

      const visible = await this.visibilities.of(query.runId);
      const stationId = StationId.of(visible.stationId);
      const station = await this.work.findStation(stationId);
      const shown = visible.candidates.flatMap((candidate) =>
        candidate.runs.map((run) => run.runId),
      );
      const ran = new Map(
        (station
          ? await this.history.runsAmong(
              { stationId, name: station.name },
              shown,
              visible.heldOutTasks,
            )
          : []
        ).map((each) => [each.runId, each]),
      );

      const configs = await this.history.configsNamed([
        ...visible.candidates.map((candidate) => candidate.fingerprint),
        ...[...ran.values()].flatMap((each) => each.fingerprint ?? []),
      ]);

      return {
        configs,
        candidates: visible.candidates.map((candidate) => ({
          candidateName: candidate.name,
          fingerprint: candidate.fingerprint,
          hypothesis: candidate.hypothesis,
          block: candidate.block,
          runs: candidate.runs.flatMap((run) => {
            const written = ran.get(run.runId);

            return written
              ? [
                  {
                    ...written,
                    original: run.original,
                    repeat: run.repeat,
                    succeeded: run.succeeded,
                    reasons: [...run.reasons],
                    verdict: run.verdict,
                    guidance: run.guidance,
                  },
                ]
              : [];
          }),
        })),
        seedBlock: visible.seedBlock,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
