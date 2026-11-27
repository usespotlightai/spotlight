import type {
  ImprovementSearchDto,
  ImprovementSetDto,
  StationImprovementDto,
} from '@replays/application/dto/station-improvement.dto';
import type { TrialableRunsPort } from '@replays/application/ports/trialable-runs.port';
import type { ReadStationImprovementQuery } from '@replays/application/queries/read-station-improvement.query';
import {
  improvementSearchView,
  improvementSetView,
  improvementSkipView,
} from '@replays/application/queries/views/station-improvement-view';
import type { ReplaysAccess } from '@replays/application/services/replays-access.service';
import { resultPendingAt } from '@replays/application/services/result-pending';
import type { SetHealths } from '@replays/application/services/set-healths.service';
import type {
  LiveConfig,
  StationConfigs,
} from '@replays/application/services/station-configs.service';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ConfigPullRequestRepository } from '@replays/domain/repositories/config-pull-request.repository';
import type { ReplaySetRepository } from '@replays/domain/repositories/replay-set.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { StationSearchScheduleRepository } from '@replays/domain/repositories/station-search-schedule.repository';
import {
  nextDueAt,
  standingSkipOf,
} from '@replays/domain/services/search-schedule';
import { HeldOutSplit } from '@replays/domain/value-objects/held-out-split.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class ReadStationImprovementHandler implements QueryHandlerPort<
  ReadStationImprovementQuery,
  StationImprovementDto
> {
  constructor(
    private readonly access: ReplaysAccess,
    private readonly sets: ReplaySetRepository,
    private readonly schedules: StationSearchScheduleRepository,
    private readonly searches: SearchRepository,
    private readonly replays: ReplayRepository,
    private readonly candidates: CandidateRepository,
    private readonly pullRequests: ConfigPullRequestRepository,
    private readonly configs: StationConfigs,
    private readonly healths: SetHealths,
    private readonly trialableRuns: TrialableRunsPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    query: ReadStationImprovementQuery,
  ): Promise<StationImprovementDto> {
    try {
      const access = await this.access.forTeam(query.teamId, query.principal);
      const station = await this.access.stationOn(
        access,
        query.lineId,
        query.stationId,
      );
      const [set, schedule, live, last] = await Promise.all([
        this.sets.ofStation(station.stationId),
        this.schedules.ofStation(station.stationId),
        this.configs.live(station.lineId, station.stationId),
        this.searches.newestAtStation(station.stationId),
      ]);
      const policy = live?.search ?? null;
      const skip = standingSkipOf(policy, schedule?.lastSkip ?? null);

      return {
        set: set && (await this.setOf(set, schedule, live)),
        scoring: live && {
          judge: live.scoring.judges,
          check: live.scoring.checksChanges,
          scores: live.scoring.scores,
        },
        lastSearch: last && (await this.searchOf(last, station.workspaceId)),
        nextSearchAt:
          schedule &&
          (nextDueAt({
            policy,
            lastStartedAt: schedule.lastStartedAt,
            cooldownFrom: schedule.cooldownFrom,
            alertPendingSince: schedule.alertPendingSince,
            checkAfter: schedule.checkAfter,
            busy: await this.busy(last, station.stationId),
            skipped: schedule.lastSkip !== null,
            now: this.clock.now(),
          })?.toISOString() ??
            null),
        lastSkip:
          schedule && skip
            ? improvementSkipView(skip, schedule.checkAfter)
            : null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async busy(
    last: Search | null,
    stationId: StationId,
  ): Promise<boolean> {
    return (
      (last?.isActive ?? false) ||
      (await resultPendingAt(stationId, this.searches, this.pullRequests))
    );
  }

  private async setOf(
    set: ReplaySet,
    schedule: StationSearchSchedule | null,
    live: LiveConfig | null,
  ): Promise<ImprovementSetDto> {
    const standard = this.healths.standardOf(live);

    return improvementSetView(
      HeldOutSplit.sizeOf({
        entries: set.entries,
        excluding: schedule?.searchedTasks ?? [],
      }),
      await this.healths.ofSet(set, standard),
      standard.minGain,
    );
  }

  private async searchOf(
    search: Search,
    workspaceId: WorkspaceId,
  ): Promise<ImprovementSearchDto> {
    const replays = await this.replays.ofSearch(search.id);
    const [candidates, summaries] = await Promise.all([
      this.candidates.findMany(replays.map((each) => each.candidateId)),
      this.trialableRuns.runSummaries(workspaceId, [
        ...new Map(
          replays
            .flatMap((each) => each.entries)
            .map((entry) => [entry.original.value, entry.original]),
        ).values(),
      ]),
    ]);

    return improvementSearchView(search, replays, candidates, summaries);
  }
}
