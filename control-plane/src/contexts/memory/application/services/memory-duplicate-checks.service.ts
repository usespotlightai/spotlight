import type { LinesPort } from '@memory/application/ports/lines.port';
import type {
  ProposalComparerPort,
  ProposalComparisonRequest,
} from '@memory/application/ports/proposal-comparer.port';
import { placeOf } from '@memory/application/services/memory-places';
import type { DuplicateCheck } from '@memory/domain/aggregates/duplicate-check.aggregate';
import type { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { DuplicateCheckVersionConflictError } from '@memory/domain/exceptions/duplicate-check-version-conflict.error';
import type { DuplicateCheckRepository } from '@memory/domain/repositories/duplicate-check.repository';
import type { MemoryProposalSetRepository } from '@memory/domain/repositories/memory-proposal-set.repository';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import {
  questionFor,
  verdictsFrom,
} from '@memory/domain/services/duplicate-comparison';
import type { DuplicateQuestion } from '@memory/domain/value-objects/duplicate-question.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const MAX_CHECKS_AT_ONCE = 2;

const requestOf = (
  check: DuplicateCheck,
  question: DuplicateQuestion,
): ProposalComparisonRequest => {
  const handles = new Map(
    question.memories.map((each) => [each.memory.value, each.handle.value]),
  );

  return {
    workspaceId: check.workspaceId.value,
    run: check.runId,
    proposals: question.proposals.map((each) => ({
      ref: each.ref,
      kind: each.kind,
      body: each.body,
      where: each.where,
      candidates: each.candidates.map((id) => handles.get(id.value) ?? ''),
    })),
    memories: question.memories.map((each) => ({
      handle: each.handle.value,
      kind: each.kind,
      body: each.body,
      where: each.where,
    })),
  };
};

/**
 * Asks a model whether what a run proposed to remember repeats a memory of its team, once the run ended. The check
 * records its question and orders an assist session with it, then waits while the session works, outside any
 * transaction, reading every answer against that question. When the session fails, the check fails and the proposals
 * show no repeat. A check whose task's proposals are gone is removed.
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

  private async checked(leased: DuplicateCheck): Promise<DuplicateCheck> {
    const set = await this.sets.forTask(leased.taskId);

    if (!set || !leased.isFor(set.id)) {
      return leased.delete();
    }

    const check = leased.question ? leased : await this.asked(leased, set);
    const question = check?.question;

    if (!check || !question) {
      return leased.compared([]);
    }

    const answer = await this.comparer.compare(requestOf(check, question));
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

    return check.compared(verdictsFrom(question, answer.verdicts));
  }

  /**
   * Records the question before the session is ordered with it, so every later attempt asks and reads the same, and
   * returns the check as stored. Null when no proposal has a memory to compare with.
   */
  private async asked(
    check: DuplicateCheck,
    set: MemoryProposalSet,
  ): Promise<DuplicateCheck | null> {
    const memories = await this.memories.ofTeam(check.teamId);
    const lines = await this.lines.ofTeam(check.teamId);
    const question = questionFor({
      set,
      runId: check.runId,
      memories,
      whereOf: (scope) => placeOf(scope, lines),
    });

    if (!question) {
      return null;
    }

    await this.checks.save(check.asking(question));
    const stored = await this.checks.of(check.runId);

    if (!stored?.question) {
      throw new DuplicateCheckVersionConflictError(check.runId.value);
    }

    return stored;
  }
}
