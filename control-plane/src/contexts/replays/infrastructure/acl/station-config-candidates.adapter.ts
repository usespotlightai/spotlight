import type { HashPort } from '@replays/application/ports/hash.port';
import type {
  CandidateValidation,
  LiveStationConfig,
  StationConfigCandidatesPort,
} from '@replays/application/ports/station-config-candidates.port';
import {
  candidateScoringOf,
  stationHashesOf,
} from '@replays/domain/services/station-identity';
import type { PlannedLine } from '@replays/domain/value-objects/planned-line.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type {
  StationConfigFacts,
  StationConfigCandidatesPort as WorkStationConfigCandidatesPort,
} from '@work/application/ports/station-config-candidates.port';

export class StationConfigCandidates implements StationConfigCandidatesPort {
  constructor(
    private readonly candidates: WorkStationConfigCandidatesPort,
    private readonly hash: HashPort,
  ) {}

  async live(
    lineId: LineId,
    stationId: StationId,
  ): Promise<LiveStationConfig | null> {
    const live = await this.candidates.live(lineId.value, stationId.value);

    return live
      ? {
          lineKey: live.lineKey,
          fingerprint: StationFingerprint.of(live.config.fingerprint),
          scoring: candidateScoringOf(live.config),
          hashes: this.hashesOf(live.config),
        }
      : null;
  }

  async validate(
    lineId: LineId,
    stationId: StationId,
    block: unknown,
    line: PlannedLine | null,
  ): Promise<CandidateValidation | null> {
    const validated = await this.candidates.validate(
      lineId.value,
      stationId.value,
      block,
      line ? line.repositories : undefined,
    );

    if (!validated?.ok) {
      return validated;
    }

    return {
      ok: true,
      fingerprint: StationFingerprint.of(validated.candidate.fingerprint),
      hashes: this.hashesOf(validated.candidate),
      liveHashes: this.hashesOf(validated.live),
      scoring: candidateScoringOf(validated.candidate),
      changedFrom: StationChanges.of(
        StationFingerprint.of(validated.live.fingerprint),
        validated.changes,
      ),
    };
  }

  private hashesOf(facts: StationConfigFacts) {
    return stationHashesOf(facts, (text) => this.hash.sha256(text));
  }
}
