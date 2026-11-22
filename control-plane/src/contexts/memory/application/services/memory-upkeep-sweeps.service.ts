import type { LinesPort, TeamLine } from '@memory/application/ports/lines.port';
import type {
  ConsolidatedGroup,
  MemoryConsolidatorPort,
} from '@memory/application/ports/memory-consolidator.port';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { RepositoryPathsPort } from '@memory/application/ports/repository-paths.port';
import type { MemoryUpkeepSchedule } from '@memory/domain/aggregates/memory-upkeep-schedule.aggregate';
import { MemoryUpkeep } from '@memory/domain/aggregates/memory-upkeep.aggregate';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { UpkeepProposal } from '@memory/domain/entities/upkeep-proposal.entity';
import { MemoryUpkeepScheduleVersionConflictError } from '@memory/domain/exceptions/memory-upkeep-schedule-version-conflict.error';
import type {
  MemoryUpkeepRepository,
  MemoryUpkeepScheduleRepository,
} from '@memory/domain/repositories/memory-upkeep.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { HeldBack } from '@memory/domain/services/held-back';
import { checkedForUpkeep } from '@memory/domain/services/upkeep-checks';
import {
  consolidatedForUpkeep,
  consolidationGroupsOf,
} from '@memory/domain/services/upkeep-consolidation';
import { MemoryUpkeepId } from '@memory/domain/value-objects/memory-upkeep-id.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const MAX_SWEEPS_AT_ONCE = 2;

const distinctRepositories = (
  repositories: readonly Repository[],
): Repository[] =>
  repositories.filter(
    (each, at, all) => all.findIndex((one) => one.equals(each)) === at,
  );

const whereOf = (memory: Memory, lines: readonly TeamLine[]): string => {
  const { lineId, stationId, repository } = memory.scope;
  const line = lines.find((each) => lineId !== null && each.id.equals(lineId));
  const station = line?.stations.find(
    (each) => stationId !== null && each.id.equals(stationId),
  );
  const at = station
    ? `the station "${station.name}" of the line "${line?.name}"`
    : line
      ? `the line "${line.name}"`
      : 'the whole team';

  return repository ? `${at}, about the repository ${repository.value}` : at;
};

export class MemoryUpkeepSweeps implements PendingJobsPort {
  readonly name = 'Memory upkeep';

  readonly #loop: JobLoop<MemoryUpkeepSchedule, TeamId>;

  constructor(
    private readonly schedules: MemoryUpkeepScheduleRepository,
    private readonly upkeeps: MemoryUpkeepRepository,
    private readonly memories: MemoryRepository,
    private readonly lines: LinesPort,
    private readonly uses: MemoryUsesPort,
    private readonly paths: RepositoryPathsPort,
    private readonly consolidator: MemoryConsolidatorPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    private readonly transaction: TransactionPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<MemoryUpkeepSchedule, TeamId>(
      {
        name: this.name,
        batchSize: MAX_SWEEPS_AT_ONCE,
        due: (now) => this.schedules.nextDue(now),
        find: (teamId) => this.schedules.ofTeam(teamId),
        save: (schedule) => this.schedules.save(schedule),
        keyOf: (schedule) => schedule.teamId,
        ids: (schedule) => ({
          workspaceId: schedule.workspaceId.value,
          teamId: schedule.teamId.value,
        }),
        about: (schedule) => ({ attempts: schedule.job.attempts }),
        process: (schedule) => this.swept(schedule),
        stale: (error) =>
          error instanceof MemoryUpkeepScheduleVersionConflictError,
      },
      transaction,
      clock,
      logger,
      reports,
      telemetry,
    );
  }

  processDue(): Promise<void> {
    return this.#loop.processDue();
  }

  idle(): Promise<void> {
    return this.#loop.idle();
  }

  private async swept(
    schedule: MemoryUpkeepSchedule,
  ): Promise<MemoryUpkeepSchedule> {
    const now = this.clock.now();
    const newId = () => UpkeepProposalId.of(this.ids.generate());
    const stored = await this.memories.ofTeam(schedule.teamId);
    const lines = await this.lines.ofTeam(schedule.teamId);
    const history = await this.upkeeps.historySince(
      schedule.teamId,
      HeldBack.lookbackFrom(now),
    );
    const heldBack = HeldBack.from(history, now);
    const active = stored.filter((each) => each.isActive);
    const repositories = distinctRepositories(
      lines.flatMap((each) => each.repositories),
    );
    const paths = await this.treesOf(schedule, active, repositories);
    const lastUsed = await this.uses.lastUsed(active.map((each) => each.id));
    const checked = checkedForUpkeep(
      {
        now,
        memories: active,
        repositories,
        treeOf: (repository) => paths.get(repository.value) ?? null,
        lastUsedOf: (memory) => lastUsed.get(memory.value) ?? null,
        heldBack,
      },
      newId,
    );
    const taken = heldBack.taking(checked.flatMap((each) => each.memories));
    const proposals: UpkeepProposal[] = [
      ...checked,
      ...(await this.consolidated(schedule, active, lines, taken, newId)),
    ];

    const upkeep = MemoryUpkeep.swept({
      id: MemoryUpkeepId.of(this.ids.generate()),
      workspaceId: schedule.workspaceId,
      teamId: schedule.teamId,
      sweptAt: now,
      proposals,
    });

    if (upkeep) {
      await this.transaction.inTransaction(async () => {
        const standing = await this.schedules.ofTeamLocked(schedule.teamId);

        if (standing?.version !== schedule.version) {
          throw new MemoryUpkeepScheduleVersionConflictError(
            schedule.teamId.value,
          );
        }

        await this.upkeeps.add(upkeep);
      });
    }

    return schedule.swept(now);
  }

  private async treesOf(
    schedule: MemoryUpkeepSchedule,
    active: readonly Memory[],
    repositories: readonly Repository[],
  ): Promise<ReadonlyMap<string, ReadonlySet<string> | null>> {
    const about = distinctRepositories(
      active.flatMap((each) =>
        each.scope.repository && each.scope.paths.length > 0
          ? [each.scope.repository]
          : [],
      ),
    ).filter((each) => repositories.some((one) => one.equals(each)));

    return new Map(
      await Promise.all(
        about.map(
          async (each) =>
            [
              each.value,
              await this.paths
                .pathsAt(schedule.workspaceId, each)
                .catch((error: unknown) => {
                  this.logger.warn(
                    {
                      err: error,
                      teamId: schedule.teamId.value,
                      repository: each.value,
                    },
                    'Memory upkeep: could not list the repository; the sweep skips its path check',
                  );
                  return null;
                }),
            ] as const,
        ),
      ),
    );
  }

  private async consolidated(
    schedule: MemoryUpkeepSchedule,
    active: readonly Memory[],
    lines: readonly TeamLine[],
    taken: HeldBack,
    newId: () => UpkeepProposalId,
  ): Promise<UpkeepProposal[]> {
    const grouped = consolidationGroupsOf(active, taken);

    if (
      grouped.length === 0 ||
      !(await this.consolidator.availableTo(schedule.workspaceId.value))
    ) {
      return [];
    }

    const groups: ConsolidatedGroup[] = grouped.map((memories) => ({
      where: whereOf(memories[0], lines),
      memories: memories.map((each) => ({
        handle: each.handle.value,
        kind: each.kind,
        body: each.body.value,
      })),
    }));

    try {
      return consolidatedForUpkeep({
        suggestions: await this.consolidator.consolidate({
          workspaceId: schedule.workspaceId.value,
          groups,
        }),
        memories: grouped.flat(),
        heldBack: taken,
        newId,
      });
    } catch (error) {
      this.logger.warn(
        { err: error, teamId: schedule.teamId.value },
        'Memory upkeep: consolidation failed; the sweep keeps the other checks',
      );
      return [];
    }
  }
}
