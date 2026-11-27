import type {
  ImprovementReplayDto,
  ImprovementRunProgress,
  ImprovementSearchDto,
  ImprovementSetDto,
  ImprovementSkipDto,
} from '@replays/application/dto/station-improvement.dto';
import type { RunSummary } from '@replays/application/ports/trialable-runs.port';
import { healthView } from '@replays/application/queries/views/replay-views';
import {
  searchResultText,
  skipReasonText,
} from '@replays/application/rendering/station-improvement-words';
import type { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { SearchSkip } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import type { ReplayEntry } from '@replays/domain/entities/replay-entry.entity';
import type { SetHealth } from '@replays/domain/services/set-health';
import type { SetSize } from '@replays/domain/value-objects/held-out-split.vo';

const progressOf = (entry: ReplayEntry): ImprovementRunProgress => {
  if (entry.hasEnded) {
    return 'ended';
  }

  return entry.isWaiting ? 'waiting' : 'running';
};

export const improvementSetView = (
  size: SetSize,
  health: SetHealth,
  minGain: number,
): ImprovementSetDto => ({
  ...size,
  ...healthView(health),
  minGain,
});

const replayView = (
  replay: Replay,
  candidates: readonly Candidate[],
  summaries: readonly RunSummary[],
): ImprovementReplayDto => {
  const candidate = candidates.find((each) =>
    each.id.equals(replay.candidateId),
  );

  return {
    replayId: replay.id.value,
    candidate: candidate?.name.value ?? replay.candidateId.value,
    live: replay.liveCandidate,
    state: replay.current,
    runs: replay.entries.map((entry) => ({
      runId: entry.run?.value ?? null,
      originalRunId: entry.original.value,
      taskId: entry.taskId.value,
      taskTitle:
        summaries.find((each) => each.runId.equals(entry.original))?.title ??
        null,
      progress: progressOf(entry),
      succeeded: entry.hasEnded ? entry.succeeded : null,
    })),
  };
};

export const improvementSearchView = (
  search: Search,
  replays: readonly Replay[],
  candidates: readonly Candidate[],
  summaries: readonly RunSummary[],
): ImprovementSearchDto => ({
  searchId: search.id.value,
  state: search.current,
  trigger: search.trigger,
  startedAt: search.startedAt.toISOString(),
  endedAt: search.endedAt?.toISOString() ?? null,
  result: searchResultText(search),
  replays: [...replays]
    .sort((one, other) => one.startedAt.getTime() - other.startedAt.getTime())
    .map((each) => replayView(each, candidates, summaries)),
});

export const improvementSkipView = (
  skip: SearchSkip,
  retryAt: Date,
): ImprovementSkipDto => ({
  reason: skip.reason,
  at: skip.at.toISOString(),
  text: skipReasonText(skip.reason),
  retryAt: retryAt.toISOString(),
});
