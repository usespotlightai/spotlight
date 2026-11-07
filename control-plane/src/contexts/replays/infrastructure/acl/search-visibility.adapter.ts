import type {
  SearchVisibility as ReplaysSearchVisibility,
  SearchVisibilities,
} from '@replays/application/services/search-visibilities.service';
import type {
  SearchVisibility,
  SearchVisibilityPort,
} from '@work/application/ports/search-visibility.port';

const visibilityOf = (
  visibility: ReplaysSearchVisibility,
): SearchVisibility => ({
  stationId: visibility.stationId,
  heldOutTasks: [...visibility.heldOutTasks],
  shownOriginals: [...visibility.shownOriginals],
  candidates: visibility.candidates.map((candidate) => ({
    name: candidate.name,
    fingerprint: candidate.fingerprint,
    hypothesis: candidate.hypothesis,
    block: candidate.block,
    runs: candidate.runs.map((run) => ({
      runId: run.runId,
      original: run.original,
      repeat: run.repeat,
      succeeded: run.succeeded,
      reasons: [...run.reasons],
      verdict: run.verdict,
      guidance: run.guidance,
    })),
  })),
  seedBlock: visibility.seedBlock,
});

export class WorkSearchVisibility implements SearchVisibilityPort {
  constructor(private readonly visibilities: SearchVisibilities) {}

  async of(runId: string): Promise<SearchVisibility> {
    return visibilityOf(await this.visibilities.of(runId));
  }
}
