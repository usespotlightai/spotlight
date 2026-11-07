import type { LinesPort } from '@replays/application/ports/lines.port';
import type {
  LiveStationConfig,
  StationConfigCandidatesPort,
} from '@replays/application/ports/station-config-candidates.port';
import type { CandidateScoring } from '@replays/domain/value-objects/candidate-scoring.vo';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import type { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';

export interface LiveConfig extends LiveStationConfig {
  readonly block: StationBlock;
  readonly threshold: ReplayThreshold | null;
  readonly search: SearchPolicy | null;
  readonly agent: SearchAgent | null;
}

export type ValidatedCandidate =
  | {
      readonly ok: true;
      readonly fingerprint: StationFingerprint;
      readonly hashes: StationHashes;
      readonly liveHashes: StationHashes;
      readonly scoring: CandidateScoring;
      readonly changedFrom: StationChanges;
      readonly block: StationBlock;
    }
  | { readonly ok: false; readonly problems: readonly ConfigurationProblem[] };

export class StationConfigs {
  constructor(
    private readonly candidates: StationConfigCandidatesPort,
    private readonly lines: LinesPort,
  ) {}

  async live(lineId: LineId, stationId: StationId): Promise<LiveConfig | null> {
    const live = await this.candidates.live(lineId, stationId);
    const settings = live
      ? await this.lines.stationSettings(lineId, stationId)
      : null;

    return live && settings ? { ...live, ...settings } : null;
  }

  async validate(
    lineId: LineId,
    stationId: StationId,
    block: unknown,
    line: PlannedLine | null = null,
  ): Promise<ValidatedCandidate | null> {
    const validated = await this.candidates.validate(
      lineId,
      stationId,
      block,
      line,
    );

    if (!validated?.ok) {
      return validated;
    }

    const written = await this.lines.candidateBlock(
      lineId,
      stationId,
      block,
      line,
    );

    return written ? { ...validated, block: written } : null;
  }
}
