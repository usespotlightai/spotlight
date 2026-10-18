import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';
import type { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import type { MemoryScopeLevel } from '@memory/domain/value-objects/memory-scope-level';
import type {
  RunContext,
  TouchedContext,
} from '@memory/domain/value-objects/run-context';
import { distinct } from '@shared-kernel/domain/services/distinct';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const MAX_PATHS = 20;

export class MemoryScope {
  private constructor(
    readonly teamId: TeamId,
    readonly lineId: string | null,
    readonly stationId: string | null,
    readonly repository: Repository | null,
    readonly paths: readonly MemoryPath[],
  ) {}

  static of(input: {
    teamId: TeamId;
    lineId?: string | null;
    stationId?: string | null;
    repository?: Repository | null;
    paths?: readonly MemoryPath[];
  }): MemoryScope {
    const lineId = input.lineId?.trim() || null;
    const stationId = input.stationId?.trim() || null;
    const repository = input.repository ?? null;
    const paths = distinct(input.paths ?? []);

    if (stationId && !lineId) {
      throw new InvalidMemoryError('at a station must also name its line');
    }

    if (paths.length > 0 && !repository) {
      throw new InvalidMemoryError('about paths must name their repository');
    }

    if (paths.length > MAX_PATHS) {
      throw new InvalidMemoryError(`can cover at most ${MAX_PATHS} paths`);
    }

    return new MemoryScope(input.teamId, lineId, stationId, repository, paths);
  }

  appliesAt(runContext: RunContext): boolean {
    if (!this.teamId.equals(runContext.teamId)) {
      return false;
    }

    if (this.lineId && this.lineId !== runContext.lineId) {
      return false;
    }

    if (this.stationId && this.stationId !== runContext.stationId) {
      return false;
    }

    const { repository } = this;

    return (
      !repository ||
      runContext.repositories.some((each) => each.equals(repository))
    );
  }

  matches(runContext: TouchedContext): boolean {
    const { repository } = this;

    return (
      this.appliesAt(runContext) &&
      (this.paths.length === 0 ||
        runContext.touched.some(
          (touched) =>
            repository?.equals(touched.repository) &&
            this.paths.some((path) => path.covers(touched.path)),
        ))
    );
  }

  get specificity(): number {
    if (this.paths.length > 0) {
      return 4;
    }
    if (this.stationId) {
      return 3;
    }
    if (this.lineId) {
      return 2;
    }
    return this.repository ? 1 : 0;
  }

  get level(): MemoryScopeLevel {
    return this.stationId ? 'station' : this.lineId ? 'line' : 'team';
  }

  equals(other: MemoryScope): boolean {
    return (
      this.teamId.equals(other.teamId) &&
      this.lineId === other.lineId &&
      this.stationId === other.stationId &&
      (this.repository === null
        ? other.repository === null
        : other.repository !== null &&
          this.repository.equals(other.repository)) &&
      this.paths.length === other.paths.length &&
      this.paths.every((each, at) => other.paths[at]?.equals(each))
    );
  }
}
