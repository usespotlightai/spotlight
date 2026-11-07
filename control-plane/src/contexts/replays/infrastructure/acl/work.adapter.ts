import {
  type StationView as LineStationView,
  type LineView,
  SEARCH_OBJECTIVES,
  type SearchObjectiveView,
} from '@lines/application/contracts/line-view.contract';
import type { LineResourcesPort } from '@lines/application/ports/line-resources.port';
import type { LinesPort } from '@lines/application/ports/lines.port';
import type { HashPort } from '@replays/application/ports/hash.port';
import type {
  LiveConfig,
  PickableRun,
  RunReplayability,
  RunSummary,
  StationView,
  ValidatedCandidate,
  WorkPort,
} from '@replays/application/ports/work.port';
import {
  candidateScoringOf,
  stationHashesOf,
} from '@replays/domain/services/station-identity';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchObjective } from '@replays/domain/value-objects/search-objective';
import { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { UnreplayableReason } from '@replays/domain/value-objects/unreplayable-reason';
import type { StartingPointHoldsPort } from '@runs/application/ports/starting-point-holds.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { UntrialableReasonCode } from '@work/application/contracts/untrialable-reason.contract';
import type {
  StationConfigCandidatesPort,
  StationConfigFacts,
} from '@work/application/ports/station-config-candidates.port';
import type {
  Trialability,
  TrialableRunsPort,
} from '@work/application/ports/trialable-runs.port';

const OBJECTIVE: Readonly<Record<SearchObjectiveView, SearchObjective>> = {
  success: 'success',
  cost: 'cost',
};

export const UNTRIALABLE: Readonly<
  Record<UntrialableReasonCode, UnreplayableReason>
> = {
  'unknown-run': 'unknown-run',
  'not-a-task-run': 'not-a-task-run',
  'task-gone': 'task-gone',
  'still-running': 'still-running',
  'no-starting-point': 'no-starting-point',
  'no-briefing': 'no-briefing',
  'archive-gone': 'archive-gone',
  'attachments-gone': 'attachments-gone',
  'answer-gone': 'answer-gone',
  'repository-gone': 'repository-gone',
  'not-at-the-station': 'not-at-the-station',
  'candidate-unfit': 'candidate-unfit',
  'cannot-start': 'cannot-start',
};

const objectiveOf = (
  written: SearchObjectiveView | null,
): SearchObjective | null => {
  const published = SEARCH_OBJECTIVES.find((each) => each === written);

  return published ? OBJECTIVE[published] : null;
};

const stationOf = (line: LineView, station: LineStationView): StationView => ({
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

const replayabilityOf = (each: Trialability): RunReplayability => ({
  runId: RunId.of(each.runId),
  taskId: each.taskId ? TaskId.of(each.taskId) : null,
  stationId: each.stationId === null ? null : StationId.of(each.stationId),
  unreplayableReason:
    each.untrialableReason && UNTRIALABLE[each.untrialableReason],
  reason: each.description,
});

const searchOf = (station: LineStationView): SearchPolicy | null =>
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

const agentOf = (station: LineStationView): SearchAgent | null =>
  station.harness
    ? SearchAgent.of({
        harness: station.harness,
        model: station.model,
        effort: station.effort,
      })
    : null;

export class Work implements WorkPort {
  constructor(
    private readonly runs: TrialableRunsPort,
    private readonly candidates: StationConfigCandidatesPort,
    private readonly lines: LinesPort,
    private readonly resources: LineResourcesPort,
    private readonly startingPointHolds: StartingPointHoldsPort,
    private readonly hash: HashPort,
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

  async runSummaries(
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<readonly RunSummary[]> {
    if (runs.length === 0) {
      return [];
    }

    return (
      await this.runs.summaries(
        workspaceId.value,
        runs.map((each) => each.value),
      )
    ).map((each) => ({
      ...replayabilityOf(each),
      title: each.title,
      state: each.state,
      endedAt: each.endedAt,
      origin: each.origin,
    }));
  }

  async recentAt(
    workspaceId: WorkspaceId,
    stationId: StationId,
    max: number,
  ): Promise<readonly PickableRun[]> {
    return (
      await this.runs.recentAt(workspaceId.value, stationId.value, max)
    ).map((each) => ({
      ...replayabilityOf(each),
      title: each.title,
      state: each.state,
      endedAt: each.endedAt,
      origin: each.origin,
    }));
  }

  async validate(
    lineId: LineId,
    stationId: StationId,
    block: unknown,
    line: PlannedLine | null = null,
  ): Promise<ValidatedCandidate | null> {
    const validated = await this.candidates.validate(
      lineId.value,
      stationId.value,
      block,
      line ? line.repositories : undefined,
    );

    if (!validated?.ok) {
      return validated;
    }

    const written = await this.candidateBlockOf(lineId, stationId, block, line);

    return written
      ? {
          ok: true,
          fingerprint: StationFingerprint.of(validated.candidate.fingerprint),
          hashes: this.hashesOf(validated.candidate),
          liveHashes: this.hashesOf(validated.live),
          scoring: candidateScoringOf(validated.candidate),
          changedFrom: StationChanges.of(
            StationFingerprint.of(validated.live.fingerprint),
            validated.changes,
          ),
          block: written,
        }
      : null;
  }

  async live(lineId: LineId, stationId: StationId): Promise<LiveConfig | null> {
    const live = await this.candidates.live(lineId.value, stationId.value);
    const line = await this.lines.find(lineId);
    const station = line?.stations.find((each) => each.id === stationId.value);
    const written = station
      ? (await this.resources.withId(lineId.value))?.definition.stations.find(
          (each) => each.key === station.key,
        )
      : undefined;

    return live && line && station && written
      ? {
          lineKey: live.lineKey,
          block: StationBlock.of(written),
          fingerprint: StationFingerprint.of(live.config.fingerprint),
          scoring: candidateScoringOf(live.config),
          hashes: this.hashesOf(live.config),
          threshold: line.replayCheck && ReplayThreshold.of(line.replayCheck),
          search: searchOf(station),
          agent: agentOf(station),
        }
      : null;
  }

  private async candidateBlockOf(
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

  hold(
    holder: string,
    workspaceId: WorkspaceId,
    runs: readonly RunId[],
  ): Promise<void> {
    return this.startingPointHolds.hold(
      holder,
      workspaceId.value,
      runs.map((each) => each.value),
    );
  }

  release(holder: string): Promise<void> {
    return this.startingPointHolds.release(holder);
  }

  private hashesOf(facts: StationConfigFacts) {
    return stationHashesOf(facts, (text) => this.hash.sha256(text));
  }
}
