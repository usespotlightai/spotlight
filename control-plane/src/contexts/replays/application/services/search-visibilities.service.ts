import { SEED_HYPOTHESIS } from '@replays/application/rendering/search-briefing';
import {
  visibleGuidanceOf,
  visibleReasonsOf,
} from '@replays/application/rendering/visible-result';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import { UnknownSearchRunError } from '@replays/domain/exceptions/unknown-search-run.error';
import type { CandidateRepository } from '@replays/domain/repositories/candidate.repository';
import type { ReplayRepository } from '@replays/domain/repositories/replay.repository';
import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { SEED_NAME } from '@replays/domain/value-objects/candidate-name.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  SearchVisibility,
  SearchVisibilityPort,
  VisibleBlock,
} from '@work/application/ports/search-visibility.port';

type VisibleCandidate = SearchVisibility['candidates'][number];

type VisibleRun = VisibleCandidate['runs'][number];

const runsOf = (
  replay: Replay | undefined,
  shown: ReadonlySet<string>,
): readonly VisibleRun[] =>
  (replay?.entries ?? []).flatMap((entry) =>
    entry.run && shown.has(entry.original.value)
      ? [
          {
            runId: entry.run.value,
            original: entry.original.value,
            repeat: entry.repeat,
            succeeded: entry.succeeded,
            reasons: visibleReasonsOf(entry.reasons),
            verdict: entry.verdict
              ? entry.verdict.passes
                ? 'pass'
                : 'fail'
              : null,
            guidance: visibleGuidanceOf(entry.verdict),
          },
        ]
      : [],
  );

const blockOf = (candidate: Candidate): VisibleBlock => candidate.block.value;

export class SearchVisibilities implements SearchVisibilityPort {
  constructor(
    private readonly searches: SearchRepository,
    private readonly candidates: CandidateRepository,
    private readonly replays: ReplayRepository,
  ) {}

  async of(runId: string): Promise<SearchVisibility> {
    const search = await this.searches.ranAs(RunId.of(runId));

    if (!search) {
      throw new UnknownSearchRunError(runId);
    }

    const ids = [
      search.seed.candidateId,
      ...search.proposals.map((each) => each.candidateId),
    ];
    const candidates = await this.candidates.findMany(ids);
    const replays = await this.replays.ofSearch(search.id);
    const seed = this.found(candidates, search.seed.candidateId, runId);
    const shown = new Set(search.split.searchedRuns.map((each) => each.value));
    const replayOf = (id: ReplayId) =>
      replays.find((each) => each.id.equals(id));

    return {
      stationId: search.station.stationId,
      heldOutTasks: [
        ...new Set(search.split.heldOut.map((each) => each.taskId.value)),
      ],
      shownOriginals: [...shown],
      candidates: [
        {
          name: SEED_NAME,
          fingerprint: search.seed.fingerprint.value,
          hypothesis: SEED_HYPOTHESIS,
          block: blockOf(seed),
          runs: runsOf(replayOf(search.seed.replay.replayId), shown),
        },
        ...this.proposedIn(search, candidates).map(
          ({ proposal, candidate }) => ({
            name: proposal.name.value,
            fingerprint: candidate.fingerprint.value,
            hypothesis: candidate.search?.hypothesis.value ?? '',
            block: blockOf(candidate),
            runs: runsOf(replayOf(proposal.replay.replayId), shown),
          }),
        ),
      ],
      seedBlock: blockOf(seed),
    };
  }

  private proposedIn(search: Search, candidates: readonly Candidate[]) {
    return search.proposals.flatMap((proposal) => {
      const candidate = candidates.find((each) =>
        each.id.equals(proposal.candidateId),
      );

      return candidate ? [{ proposal, candidate }] : [];
    });
  }

  private found(
    candidates: readonly Candidate[],
    id: CandidateId,
    runId: string,
  ): Candidate {
    const candidate = candidates.find((each) => each.id.equals(id));

    if (!candidate) {
      throw new UnknownSearchRunError(runId);
    }

    return candidate;
  }
}
