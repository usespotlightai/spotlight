import type { LinesPort } from '@memory/application/ports/lines.port';
import type {
  CandidateMemory,
  ComparedProposal,
  ProposalComparerPort,
} from '@memory/application/ports/proposal-comparer.port';
import { placeOf } from '@memory/application/services/memory-places';
import type {
  DuplicateCheck,
  DuplicateComparison,
  ReportedVerdict,
} from '@memory/domain/aggregates/duplicate-check.aggregate';
import { DuplicateCheckVersionConflictError } from '@memory/domain/exceptions/duplicate-check-version-conflict.error';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const MAX_CHECKS_AT_ONCE = 2;

const refOf = (at: number): string => `P-${at + 1}`;

/**
 * Asks a model whether what a run proposed to remember repeats a memory of its team, once the run ended. The check
 * orders an assist session and waits while it works, outside any transaction; when the session fails, the check fails
 * and the proposals show no repeat.
 */
export class MemoryDuplicateChecks implements PendingJobsPort {
  readonly name = 'Memory duplicate checks';

  readonly #loop: JobLoop<DuplicateCheck, RunId>;

  constructor(
    private readonly checks: DuplicateCheckRepository,
    private readonly sets: MemoryProposalSetRepository,
    private readonly memories: MemoryRepository,
    private readonly lines: LinesPort,
    private readonly comparer: ProposalComparerPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
    transaction: TransactionPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<DuplicateCheck, RunId>(
      {
        name: this.name,
        batchSize: MAX_CHECKS_AT_ONCE,
        due: (now) => this.checks.nextDue(now),
        find: (runId) => this.checks.of(runId),
        save: (check) => this.checks.save(check),
        keyOf: (check) => check.runId,
        ids: (check) => ({
          workspaceId: check.workspaceId.value,
          teamId: check.teamId.value,
          runId: check.runId.value,
        }),
        about: (check) => ({ attempts: check.job.attempts }),
        process: (check) => this.checked(check),
        stale: (error) => error instanceof DuplicateCheckVersionConflictError,
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

  private async checked(check: DuplicateCheck): Promise<DuplicateCheck> {
    const set = await this.sets.forTask(check.taskId);
    const comparing = check.comparing(
      set,
      await this.memories.ofTeam(check.teamId),
    );

    if (comparing.length === 0) {
      return check.compared([], []);
    }

    const refs = new Map(
      comparing.map(({ proposal }, at) => [refOf(at), proposal.id]),
    );
    const answer = await this.comparer.compare({
      workspaceId: check.workspaceId.value,
      run: check.runId,
      ...(await this.described(check, comparing)),
    });
    const now = this.clock.now();

    if (answer.status === 'waiting') {
      if (check.mayWaitAgain(now)) {
        return check.waitJob(now);
      }

      this.logger.warn(
        { runId: check.runId.value },
        'Memory duplicate check: the session never settled; the proposals show no repeat',
      );
      return check.failed();
    }

    if (answer.status === 'failed') {
      this.logger.warn(
        { runId: check.runId.value, reason: answer.reason },
        'Memory duplicate check failed; the proposals show no repeat',
      );
      return check.failed();
    }

    return check.compared(
      comparing,
      answer.verdicts.flatMap((each): ReportedVerdict[] => {
        const proposal = refs.get(each.proposal.trim().toUpperCase());

        return proposal
          ? [{ proposal, sameAs: each.sameAs, reason: each.reason }]
          : [];
      }),
    );
  }

  private async described(
    check: DuplicateCheck,
    comparing: readonly DuplicateComparison[],
  ): Promise<{
    proposals: ComparedProposal[];
    memories: CandidateMemory[];
  }> {
    const lines = await this.lines.ofTeam(check.teamId);
    const memories = new Map<string, CandidateMemory>();

    for (const memory of comparing.flatMap(({ candidates }) => candidates)) {
      memories.set(memory.handle.value, {
        handle: memory.handle.value,
        kind: memory.kind,
        body: memory.body.value,
        where: placeOf(memory.scope, lines),
      });
    }

    return {
      proposals: comparing.map(({ proposal, candidates }, at) => ({
        ref: refOf(at),
        kind: proposal.kind,
        body: proposal.body.value,
        where: placeOf(proposal.scope, lines),
        candidates: candidates.map((each) => each.handle.value),
      })),
      memories: [...memories.values()],
    };
  }
}
