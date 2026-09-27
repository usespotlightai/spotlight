import { MemoryDraftingError } from '@memory/application/errors/memory-drafting.error';
import type { KnownMemoriesPort } from '@memory/application/ports/known-memories.port';
import type { MemoryDrafterPort } from '@memory/application/ports/memory-drafter.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import type { MemoryDraft } from '@memory/domain/aggregates/memory-draft.aggregate';
import type { ProposedMemory } from '@memory/domain/entities/memory-proposal.entity';
import { MemoryDraftMovedOnError } from '@memory/domain/exceptions/memory-draft-moved-on.error';
import type { MemoryDraftRepository } from '@memory/domain/repositories/memory-draft.repository';
import { DraftEvidence } from '@memory/domain/services/draft-evidence';
import { rejectionsHeededSince } from '@memory/domain/services/rejections-heeded';
import { MemoryDraftingFailure } from '@memory/domain/value-objects/memory-drafting-failure.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { OwedWorkPool } from '@shared-kernel/application/services/owed-work-pool';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const MOST_DRAFTS_AT_ONCE = 4;

export class WorkMemoryDrafts implements OwedWorkPort {
  readonly name = 'Drafting memories';

  readonly #pool: OwedWorkPool<MemoryDraft, TaskId>;

  constructor(
    private readonly drafts: MemoryDraftRepository,
    private readonly work: WorkPort,
    private readonly known: KnownMemoriesPort,
    private readonly drafter: MemoryDrafterPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    transaction: TransactionPort,
    logger: LoggerPort,
  ) {
    this.#pool = new OwedWorkPool<MemoryDraft, TaskId>(
      {
        name: this.name,
        mostAtOnce: MOST_DRAFTS_AT_ONCE,
        due: (now) => this.drafts.dueForWork(now),
        find: (taskId) => this.drafts.forTask(taskId),
        save: (draft) => this.drafts.save(draft),
        keyOf: (draft) => draft.taskId,
        about: (draft) => ({
          taskId: draft.taskId.value,
          runId: draft.drafting?.runId.value,
          attempts: draft.drafting?.work.attempts,
        }),
        worked: (draft) => this.drafted(draft),
        stale: (error) => error instanceof MemoryDraftMovedOnError,
      },
      transaction,
      clock,
      logger,
    );
  }

  workDue(): Promise<void> {
    return this.#pool.workDue();
  }

  idle(): Promise<void> {
    return this.#pool.idle();
  }

  private async drafted(draft: MemoryDraft): Promise<MemoryDraft> {
    if (!draft.drafting) {
      return draft;
    }

    const { runId } = draft.drafting;
    const [place, task, steps, changed, spoken] = await Promise.all([
      this.work.placeOf(runId),
      this.work.task(draft.taskId),
      this.work.reasoning(runId),
      this.work.changedBy(runId),
      this.work.spokenOn(draft.taskId),
    ]);

    if (!place || !task || !steps || !changed || !spoken) {
      return draft.failed(
        MemoryDraftingFailure.of('no-evidence', this.clock.now()),
      );
    }

    const reach = {
      teamId: place.teamId,
      lineId: place.lineId,
      stationId: place.stationId,
      repositories: place.repositories,
    };
    const [standing, rejected] = await Promise.all([
      this.known.standingIn(reach),
      this.known.rejectedIn(reach, rejectionsHeededSince(this.clock.now())),
    ]);
    const evidence = DraftEvidence.of({
      taskId: draft.taskId,
      runId,
      place: reach,
      steps,
      notes: spoken.filter((each) => draft.reads(each.position)),
      notesRead: draft.notesRead,
      changed,
      standing: standing.map((each) => each.id),
      fromOutside: task.fromOutside,
    });
    let proposed: readonly ProposedMemory[] = [];

    try {
      proposed = evidence.isEmpty
        ? []
        : await this.drafter.draft({
            lineName: place.lineName,
            stationName: place.stationName,
            repositories: place.repositories.map((each) => each.value),
            steps: evidence.steps,
            stepsLeftOut: evidence.stepsLeftOut,
            notes: evidence.notes,
            changed: evidence.changed,
            standing,
            rejected,
          });
    } catch (error) {
      if (error instanceof MemoryDraftingError) {
        return draft.failed(
          MemoryDraftingFailure.of(error.trouble, this.clock.now()),
        );
      }
      throw error;
    }

    return draft.drafted({
      runId,
      proposed,
      evidence,
      newId: () => this.ids.generate(),
      now: this.clock.now(),
    });
  }
}
