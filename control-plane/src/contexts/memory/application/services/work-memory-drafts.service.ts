import { MemoryDraftingError } from '@memory/application/errors/memory-drafting.error';
import type {
  KnownMemory,
  MemoryDrafterPort,
} from '@memory/application/ports/memory-drafter.port';
import type { RejectedMemoriesPort } from '@memory/application/ports/rejected-memories.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { MemoriesInReach } from '@memory/application/services/memories-in-reach.service';
import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryDraftVersionConflictError } from '@memory/domain/exceptions/memory-draft-version-conflict.error';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import {
  rejectionsHeededAt,
  rejectionsHeededSince,
} from '@memory/domain/services/rejections-heeded';
import type { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import type { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { ErrorReportsPort } from '@shared-kernel/application/ports/error-reports.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { JobLoop } from '@shared-kernel/application/services/job-loop';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const MAX_DRAFTS_AT_ONCE = 4;

const known = (each: {
  readonly id: MemoryId;
  readonly kind: MemoryKind;
  readonly body: MemoryBody;
}): KnownMemory => ({
  id: each.id.value,
  kind: each.kind,
  body: each.body.value,
});

export class WorkMemoryDrafts implements PendingJobsPort {
  readonly name = 'Drafting memories';

  readonly #loop: JobLoop<MemoryDraft, TaskId>;

  constructor(
    private readonly drafts: MemoryDraftRepository,
    private readonly work: WorkPort,
    private readonly inReach: MemoriesInReach,
    private readonly rejections: RejectedMemoriesPort,
    private readonly drafter: MemoryDrafterPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
    reports: ErrorReportsPort,
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

    const { runId } = draft.drafting;
    const [site, task, steps, changed, notes] = await Promise.all([
      this.work.stationSiteOf(runId),
      this.work.task(draft.taskId),
      this.work.reasoning(runId),
      this.work.changedBy(runId),
      this.work.notesOf(draft.taskId),
    ]);

    if (!site || !task || !steps || !changed || !notes) {
      return draft.failed(
        MemoryDraftingFailure.of('no-evidence', this.clock.now()),
      );
    }

    const [candidates, rejected] = await Promise.all([
      this.inReach.at(site),
      this.rejections.rejectedOnTeam(
        site.teamId,
        rejectionsHeededSince(this.clock.now()),
      ),
    ]);
    const evidence = DraftEvidence.of({
      taskId: draft.taskId,
      runId,
      site,
      steps,
      notes: notes.filter((each) => draft.reads(each.position)),
      notesRead: draft.notesRead,
      changed,
      known: candidates,
      fromOutside: task.fromOutside,
    });
    let proposed: readonly ProposedMemory[] = [];

    try {
      proposed = evidence.isEmpty
        ? []
        : await this.drafter.draft({
            lineName: site.lineName,
            stationName: site.stationName,
            repositories: site.repositories.map((each) => each.value),
            steps: evidence.steps,
            stepsLeftOut: evidence.stepsLeftOut,
            notes: evidence.notes,
            changed: evidence.changed,
            active: evidence.active.map(known),
            proposed: draft.stillRemembered.map(known),
            rejected: rejectionsHeededAt(rejected, site).map(
              ({ id, kind, body }) => ({ id, kind, body }),
            ),
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
      runId,
      proposed,
      evidence,
      newId: () => this.ids.generate(),
      now: this.clock.now(),
    });
  }
}
