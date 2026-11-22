import { MemoryDraftingError } from '@memory/application/errors/memory-drafting.error';
import type {
  KnownMemory,
  MemoryDrafterPort,
} from '@memory/application/ports/memory-drafter.port';
import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { RejectedMemoriesPort } from '@memory/application/ports/rejected-memories.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { ApplicableMemories } from '@memory/application/services/applicable-memories.service';
import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryDraftVersionConflictError } from '@memory/domain/exceptions/memory-draft-version-conflict.error';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import {
  recentRejectionsAt,
  recentRejectionsSince,
} from '@memory/domain/services/recent-rejections';
import type { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MEMORY_USES } from '@memory/domain/value-objects/memory-use';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TelemetryPort } from '@shared-kernel/application/ports/telemetry.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const MAX_DRAFTS_AT_ONCE = 4;

const known = (each: {
  readonly kind: MemoryKind;
  readonly body: MemoryBody;
}): KnownMemory => ({
  handle: null,
  kind: each.kind,
  body: each.body.value,
});

const approved = (each: Memory): KnownMemory => ({
  ...known(each),
  handle: each.handle.value,
});

export class WorkMemoryDrafts implements PendingJobsPort {
  readonly name = 'Drafting memories';

  readonly #loop: JobLoop<MemoryDraft, TaskId>;

  constructor(
    private readonly drafts: MemoryDraftRepository,
    private readonly work: WorkPort,
    private readonly applicable: ApplicableMemories,
    private readonly rejections: RejectedMemoriesPort,
    private readonly uses: MemoryUsesPort,
    private readonly drafter: MemoryDrafterPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
    telemetry: TelemetryPort,
  ) {
    this.#loop = new JobLoop<MemoryDraft, TaskId>(
      {
        name: this.name,
        batchSize: MAX_DRAFTS_AT_ONCE,
        due: (now) => this.drafts.nextDueJob(now),
        find: (taskId) => this.drafts.forTask(taskId),
        save: (draft) => this.drafts.save(draft),
        keyOf: (draft) => draft.taskId,
        ids: (draft) => ({
          workspaceId: draft.workspaceId.value,
          taskId: draft.taskId.value,
          runId: draft.drafting?.runId.value,
        }),
        about: (draft) => ({
          attempts: draft.drafting?.job.attempts,
        }),
        process: (draft) => this.drafted(draft),
        stale: (error) => error instanceof MemoryDraftVersionConflictError,
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

  private async drafted(draft: MemoryDraft): Promise<MemoryDraft> {
    if (!draft.drafting) {
      return draft;
    }

    const { turn, runId } = draft.drafting;
    const [runContext, task, steps, changed, notes] = await Promise.all([
      this.work.stationContextOf(runId),
      this.work.task(draft.taskId),
      this.work.reasoningThrough(turn),
      this.work.changedThrough(turn),
      this.work.notesOf(draft.taskId),
    ]);

    if (!runContext || !task || !steps || !changed || !notes) {
      return draft.failed(
        MemoryDraftingFailure.of('no-evidence', this.clock.now()),
      );
    }

    const [candidates, elsewhere, used, rejected] = await Promise.all([
      this.applicable.at(runContext),
      this.applicable.elsewhere(runContext),
      this.uses.usedBy(runId, MEMORY_USES),
      this.rejections.rejectedOnTeam(
        runContext.teamId,
        recentRejectionsSince(this.clock.now()),
      ),
    ]);
    const evidence = DraftEvidence.of({
      taskId: draft.taskId,
      turn,
      runContext,
      steps,
      notes: notes.filter((each) => draft.reads(each.position)),
      notesRead: draft.notesRead,
      changed,
      known: candidates,
      used,
      elsewhere,
      fromOutside: task.fromOutside,
    });
    let proposed: readonly ProposedMemory[] = [];

    try {
      proposed = evidence.isEmpty
        ? []
        : await this.drafter.draft({
            workspaceId: draft.workspaceId.value,
            lineName: runContext.lineName,
            stationName: runContext.stationName,
            repositories: runContext.repositories.map((each) => each.value),
            steps: evidence.steps,
            stepsLeftOut: evidence.stepsLeftOut,
            notes: evidence.notes,
            changed: evidence.changed,
            active: evidence.active.map(approved),
            elsewhere: evidence.elsewhere.map(approved),
            proposed: draft.stillRemembered.map(known),
            rejected: recentRejectionsAt(rejected, runContext).map(known),
          });
    } catch (error) {
      if (error instanceof MemoryDraftingError) {
        return draft.failed(
          MemoryDraftingFailure.of(error.kind, this.clock.now()),
        );
      }
      throw error;
    }

    return draft.recordDraft({
      turn,
      proposed,
      evidence,
      newId: () => this.ids.generate(),
      now: this.clock.now(),
    });
  }
}
