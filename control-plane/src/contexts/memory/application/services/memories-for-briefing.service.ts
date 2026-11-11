import type { MemoryRelevancePort } from '@memory/application/ports/memory-relevance.port';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import { folderGuideAt } from '@memory/application/rendering/memory-folder-layout';
import type { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { selectForBriefing } from '@memory/domain/services/briefing-selection';
import {
  laysOutFolder,
  MEMORY_FOLDER,
} from '@memory/domain/services/memory-folder';
import { BriefingAbout } from '@memory/domain/value-objects/briefing-about.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import type { RunContext } from '@memory/domain/value-objects/run-context';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type {
  MemoriesBriefedBeforePort,
  NamedMemory,
} from '@work/application/ports/memories-briefed-before.port';
import type {
  BriefedContext,
  BriefingContext,
  BriefingSelection,
  MemoryFolder,
  TeamMemoriesPort,
  TouchedFile,
} from '@work/application/ports/team-memories.port';

const pathOf = (raw: string): MemoryPath | null => {
  try {
    return MemoryPath.of(raw);
  } catch (error) {
    if (error instanceof InvalidMemoryError) {
      return null;
    }
    throw error;
  }
};

const contextOf = (briefing: BriefedContext): RunContext => ({
  teamId: briefing.teamId,
  lineId: briefing.lineId === null ? null : LineId.of(briefing.lineId),
  stationId:
    briefing.stationId === null ? null : StationId.of(briefing.stationId),
  repositories: briefing.repositories,
});

const folderAt = (runContext: RunContext, laid: boolean): MemoryFolder | null =>
  laid
    ? {
        path: MEMORY_FOLDER,
        guide: folderGuideAt(runContext),
      }
    : null;

export class MemoriesForBriefing
  implements TeamMemoriesPort, MemoriesBriefedBeforePort
{
  constructor(
    private readonly applicable: ApplicableMemories,
    private readonly relevance: MemoryRelevancePort,
    private readonly uses: MemoryUsesPort,
    private readonly memories: MemoryRepository,
  ) {}

  async again(
    briefing: BriefedContext,
    chosen: {
      readonly briefed: readonly NamedMemory[];
      readonly omitted: readonly NamedMemory[];
    },
    asOf: Date,
  ): Promise<BriefingSelection> {
    const runContext = contextOf(briefing);
    const stored = await this.memories.findAll(
      chosen.briefed.map((each) => MemoryId.of(each.id)),
    );
    const applying = await this.applicable.at(runContext, asOf);
    const teamMemories = new Map(
      stored
        .filter((each) => each.isTeams(briefing.teamId))
        .map((each) => [each.id.value, each]),
    );

    return {
      briefed: chosen.briefed.flatMap((each) => {
        const memory = teamMemories.get(each.id);

        return memory
          ? [
              {
                id: memory.id.value,
                handle: memory.handle.value,
                kind: memory.kind,
                body: memory.body.value,
              },
            ]
          : [];
      }),
      omitted: chosen.omitted.map((each) => ({
        id: each.id,
        handle: each.handle,
      })),
      folder: folderAt(
        runContext,
        laysOutFolder({
          applying: applying.length,
          briefed: teamMemories.size,
        }),
      ),
    };
  }

  async forBriefing(briefing: BriefingContext): Promise<BriefingSelection> {
    const runContext = contextOf(briefing);
    const applying = await this.applicable.at(runContext);
    const ids = applying.map((each) => each.id);
    const touched = applying.some((each) => each.scope.paths.length > 0)
      ? await briefing.touched()
      : ([] as readonly TouchedFile[]);
    const ranks = await this.relevance.rank(
      ids,
      BriefingAbout.of(briefing.about),
    );
    const recalled = await this.uses.runsUsing(ids, 'recalled');

    const chosen = selectForBriefing(
      applying.map((memory) => ({
        memory,
        rank: ranks.get(memory.id.value) ?? 0,
        recalled: recalled.get(memory.id.value) ?? 0,
      })),
      {
        ...runContext,
        touched: touched.flatMap((each) => {
          const path = pathOf(each.path);
          return path ? [{ repository: each.repository, path }] : [];
        }),
      },
    );

    return {
      briefed: chosen.briefed.map((each) => ({
        id: each.id.value,
        handle: each.handle.value,
        kind: each.kind,
        body: each.body.value,
      })),
      omitted: chosen.omitted.map((each) => ({
        id: each.id.value,
        handle: each.handle.value,
      })),
      folder: folderAt(
        runContext,
        laysOutFolder({
          applying: applying.length,
          briefed: chosen.briefed.length,
        }),
      ),
    };
  }
}
