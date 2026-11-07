import {
  type LineView,
  type StationView as PublishedStationView,
  SEARCH_OBJECTIVES,
  type SearchObjectiveView,
  type StationKindView,
} from '@lines/application/contracts/line-view.contract';
import type { LineResourcesPort } from '@lines/application/ports/line-resources.port';
import type { LinesPort as PublishedLinesPort } from '@lines/application/ports/lines.port';
import type {
  LinesPort,
  NamedStation,
  SearchedStation,
  StationSettings,
  StationView,
} from '@replays/application/ports/lines.port';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const RUNS_AN_AGENT: Readonly<Record<StationKindView, boolean>> = {
  backlog: false,
  work: true,
  completed: false,
};

const OBJECTIVE: Readonly<Record<SearchObjectiveView, SearchObjective>> = {
  success: 'success',
  cost: 'cost',
};

const objectiveOf = (
  written: SearchObjectiveView | null,
): SearchObjective | null => {
  const published = SEARCH_OBJECTIVES.find((each) => each === written);

  return published ? OBJECTIVE[published] : null;
};

const stationOf = (
  line: LineView,
  station: PublishedStationView,
): StationView => ({
  workspaceId: WorkspaceId.of(line.workspaceId),
  teamId: TeamId.of(line.teamId),
  lineId: LineId.of(line.id),
  lineKey: line.key,
  stationId: StationId.of(station.id),
  key: station.key,
  name: station.name,
  source: line.source
    ? {
        repository: Repository.of(line.source.repository),
        path: line.source.path,
      }
    : null,
});

const searchOf = (station: PublishedStationView): SearchPolicy | null =>
  station.search &&
  SearchPolicy.of({
    enabled: station.search.enabled,
    monthlyCeiling: station.search.monthlyCeiling,
    currency: station.search.currency,
    ceiling: station.search.ceiling,
    periodMilliseconds: station.search.periodMilliseconds,
    onAlert: station.search.onAlert,
    cooldownMilliseconds: station.search.cooldownMilliseconds,
    agent: station.search.agent && { ...station.search.agent },
    iterations: station.search.iterations,
    repeats: station.search.repeats,
    objective: objectiveOf(station.search.objective),
  });

const agentOf = (station: PublishedStationView): SearchAgent | null =>
  station.harness
    ? SearchAgent.of({
        harness: station.harness,
        model: station.model,
        effort: station.effort,
      })
    : null;

export class Lines implements LinesPort {
  constructor(
    private readonly lines: PublishedLinesPort,
    private readonly resources: LineResourcesPort,
  ) {}

  async station(
    lineId: LineId,
    stationId: StationId,
  ): Promise<StationView | null> {
    const line = await this.lines.find(lineId);
    const station = line?.stations.find((each) => each.id === stationId.value);

    return line && station ? stationOf(line, station) : null;
  }

  async findStation(stationId: StationId): Promise<StationView | null> {
    const line = await this.lines.findByStation(stationId);
    const station = line?.stations.find((each) => each.id === stationId.value);

    return line && station ? stationOf(line, station) : null;
  }

  async keyed(lineId: LineId, key: string): Promise<StationView | null> {
    const parsed = StationKey.parsed(key);
    const line = parsed ? await this.lines.find(lineId) : null;
    const station = line?.stations.find((each) => each.key === parsed?.value);

    return line && station ? stationOf(line, station) : null;
  }

  async stationSettings(
    lineId: LineId,
    stationId: StationId,
  ): Promise<StationSettings | null> {
    const line = await this.lines.find(lineId);
    const station = line?.stations.find((each) => each.id === stationId.value);
    const written = station
      ? (await this.resources.withId(lineId))?.definition.stations.find(
          (each) => each.key === station.key,
        )
      : undefined;

    return line && station && written
      ? {
          block: StationBlock.of(written),
          threshold: line.replayCheck && ReplayThreshold.of(line.replayCheck),
          search: searchOf(station),
          agent: agentOf(station),
        }
      : null;
  }

  async candidateBlock(
    lineId: LineId,
    stationId: StationId,
    block: unknown,
    line: PlannedLine | null,
  ): Promise<StationBlock | null> {
    const current = await this.lines.find(lineId);
    const station = current?.stations.find(
      (each) => each.id === stationId.value,
    );
    const key = station ? StationKey.parsed(station.key) : null;
    const preview = key
      ? await this.lines.preview({
          lineId,
          stationKey: key,
          block,
          ...(line ? { repositories: line.repositories } : {}),
        })
      : null;
    const written = preview?.ok
      ? preview.definition.stations.find((each) => each.key === key?.value)
      : undefined;

    return written ? StationBlock.of(written) : null;
  }

  async namedStation(
    lineId: LineId,
    stationId: StationId,
  ): Promise<NamedStation | null> {
    const line = await this.lines.find(lineId);
    const station = line?.stations.find((each) => each.id === stationId.value);

    return line && station
      ? {
          lineKey: line.key,
          lineName: line.name,
          key: station.key,
          name: station.name,
        }
      : null;
  }

  async searchedStation(
    lineId: LineId,
    stationId: StationId,
  ): Promise<SearchedStation | null> {
    const line = await this.lines.find(lineId);
    const station = line?.stations.find((each) => each.id === stationId.value);

    if (!line || !station) {
      return null;
    }

    const placement = RunnerPlacement.forStation(
      RunnerPlacement.of(station.runners),
      RunnerPlacement.of(line.runners),
      line.image ? RunnerImage.of(line.image) : null,
    );

    return {
      workspaceId: WorkspaceId.of(line.workspaceId),
      teamId: TeamId.of(line.teamId),
      runsAnAgent: RUNS_AN_AGENT[station.kind],
      placement: {
        labelGroups: placement.labelGroups,
        image: placement.image?.value ?? null,
      },
    };
  }
}
