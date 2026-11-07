import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export interface LaidOutLine {
  readonly id: LineId;
  readonly stations: readonly StationId[];
  readonly repositories: readonly Repository[];
}

export interface WrittenScope {
  readonly lineId?: string | null;
  readonly stationId?: string | null;
  readonly repository?: string | null;
  readonly paths?: readonly string[];
}

export class TeamLayout {
  private constructor(
    private readonly teamId: TeamId,
    private readonly lines: readonly LaidOutLine[],
  ) {}

  static of(input: {
    teamId: TeamId;
    lines: readonly LaidOutLine[];
  }): TeamLayout {
    return new TeamLayout(input.teamId, input.lines);
  }

  scopeOf(written: WrittenScope): MemoryScope {
    const lineNamed = written.lineId?.trim() || null;
    const stationNamed = written.stationId?.trim() || null;
    const line = lineNamed
      ? this.lines.find((each) => each.id.value === lineNamed)
      : null;

    if (lineNamed && !line) {
      throw new InvalidMemoryError('must be at a line of its team');
    }

    const station = stationNamed
      ? line?.stations.find((each) => each.value === stationNamed)
      : null;

    if (stationNamed && !station) {
      throw new InvalidMemoryError('must be at a station of its line');
    }

    const named = written.repository?.trim() || null;
    const repository = named
      ? (line ? [line] : this.lines)
          .flatMap((each) => each.repositories)
          .find((each) => each.value === named)
      : null;

    if (named && !repository) {
      throw new InvalidMemoryError(
        'can only name a repository its team or line works in',
      );
    }

    return MemoryScope.of({
      teamId: this.teamId,
      lineId: line?.id ?? null,
      stationId: station ?? null,
      repository,
      paths: (written.paths ?? [])
        .filter((each) => each.trim())
        .map(MemoryPath.of),
    });
  }
}
