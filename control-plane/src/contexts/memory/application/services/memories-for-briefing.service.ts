import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { selectForBriefing } from '@memory/domain/services/briefing-selection';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import type {
  BriefingPlace,
  BriefingSelection,
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

export class MemoriesForBriefing implements TeamMemoriesPort {
  constructor(private readonly memories: MemoryRepository) {}

  async forBriefing(place: BriefingPlace): Promise<BriefingSelection> {
    const candidates = await this.memories.mayReach(place);
    const touched: readonly TouchedFile[] = candidates.some(
      (each) => each.scope.paths.length > 0,
    )
      ? await place.touched()
      : [];

    const chosen = selectForBriefing(candidates, {
      teamId: place.teamId,
      lineId: place.lineId,
      stationId: place.stationId,
      repositories: place.repositories,
      touched: touched.flatMap((each) => {
        const path = pathOf(each.path);
        return path ? [{ repository: each.repository, path }] : [];
      }),
    });

    return {
      briefed: chosen.briefed.map((each) => ({
        id: each.id.value,
        handle: each.handle.value,
        kind: each.kind,
        body: each.body,
      })),
      cut: chosen.cut.map((each) => ({
        id: each.id.value,
        handle: each.handle.value,
      })),
    };
  }
}
