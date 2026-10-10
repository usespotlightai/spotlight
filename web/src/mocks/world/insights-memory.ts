import type {
  FlaggedMemoryResponseDto,
  InsightsMemoryResponseDto,
} from '@/lib/api';
import type { HistoryRun } from '@/mocks/world/insights-history';
import {
  type PeriodName,
  spanOf,
  within,
} from '@/mocks/world/insights-measures';
import { profileOf } from '@/mocks/world/insights-profiles';
import { runsIn, tallyOf, verdictsOf } from '@/mocks/world/insights-tally';
import { type MemoryRecord, teamMemories } from '@/mocks/world/team-memories';

const standingAt = (memory: MemoryRecord, at: number): boolean =>
  Date.parse(memory.approvedAt) <= at &&
  (memory.retirement === null || at < Date.parse(memory.retirement.at));

const writesCode = (run: HistoryRun): boolean =>
  profileOf(run.stationId)?.checks ?? false;

const reaches = (memory: MemoryRecord, run: HistoryRun): boolean =>
  (memory.lineId === null || memory.lineId === run.lineId) &&
  (memory.stationId === null || memory.stationId === run.stationId) &&
  (memory.repository === null ||
    run.repositories.includes(memory.repository)) &&
  (memory.kind !== 'preference' || memory.lineId !== null || writesCode(run));

const briefedWith = (
  memories: readonly MemoryRecord[],
  run: HistoryRun,
): MemoryRecord[] =>
  memories.filter(
    (memory) => standingAt(memory, run.at) && reaches(memory, run),
  );

const recalled = (run: HistoryRun): boolean =>
  [...run.runId].reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 9 < 2;

const flaggedOf = (memory: MemoryRecord): FlaggedMemoryResponseDto | null =>
  memory.retirement?.by && !memory.retirement.supersededBy
    ? {
        memoryId: memory.id,
        handle: memory.handle,
        body: memory.body,
        reason: memory.retirement.reason,
        by: memory.retirement.by.id,
        byName: memory.retirement.by.name,
        at: memory.retirement.at,
      }
    : null;

export const memoryOf = (
  teamId: string,
  name: PeriodName,
): InsightsMemoryResponseDto => {
  const span = spanOf(name);
  const memories = teamMemories()[teamId] ?? [];
  const runs = runsIn(teamId, span.now);
  const briefings = runs.map((run) => ({
    run,
    memories: briefedWith(memories, run),
  }));
  const briefed = briefings.filter((each) => each.memories.length > 0);
  const withMemories = briefed.map((each) => each.run);
  const withoutMemories = briefings
    .filter((each) => each.memories.length === 0)
    .map((each) => each.run);
  const briefedIds = new Set(
    briefed.flatMap((each) => each.memories.map((memory) => memory.id)),
  );
  const recalledIds = new Set(
    briefed
      .filter((each) => recalled(each.run))
      .flatMap((each) =>
        each.memories
          .filter((memory) => memory.reach !== 'team')
          .map((memory) => memory.id),
      ),
  );

  return {
    period: span.period,
    truncated: false,
    standing: memories.filter((memory) => memory.standing === 'stands').length,
    memoriesBriefed: briefedIds.size,
    memoriesRecalled: recalledIds.size,
    runsBriefed: withMemories.length,
    runsRecalled: withMemories.filter(recalled).length,
    flagged: memories
      .flatMap((memory) => {
        const flagged = flaggedOf(memory);
        return flagged && within(Date.parse(flagged.at), span.now)
          ? [flagged]
          : [];
      })
      .sort((one, other) => other.at.localeCompare(one.at)),
    withMemories: tallyOf(withMemories),
    withoutMemories: tallyOf(withoutMemories),
    verdicts: verdictsOf(withoutMemories, withMemories),
    benchmark: null,
  };
};
