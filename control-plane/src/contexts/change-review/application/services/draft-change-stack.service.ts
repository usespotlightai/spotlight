import type { ChangeStackDrafterPort } from '@change-review/application/ports/change-stack-drafter.port';
import type { CodeReadingPort } from '@change-review/application/ports/code-reading.port';
import type {
  DiffReaderPort,
  DiffSources,
} from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import { attemptDrafting } from '@change-review/application/services/drafting-attempt';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStacksUnavailableError } from '@change-review/domain/exceptions/change-stacks-unavailable.error';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import { factsOf } from '@change-review/domain/services/diff-facts';
import {
  NO_INDEX,
  type SymbolIndex,
} from '@change-review/domain/services/symbol-index';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const ATTEMPTS = 2;

export interface DraftingRun {
  readonly id: RunId;
  readonly taskId: TaskId | null;
  readonly replay: boolean;
  readonly workspaceId: WorkspaceId;
}

export class DraftChangeStack {
  constructor(
    private readonly stacks: ChangeStackRepository,
    private readonly drafter: ChangeStackDrafterPort,
    private readonly reader: DiffReaderPort,
    private readonly reading: CodeReadingPort,
    private readonly indexer: SymbolIndexerPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async begin(
    run: DraftingRun,
    input: {
      diff: string;
      repository: string | null;
      base: string | null;
      request: CheckRequest | null;
    },
  ): Promise<ChangeStack> {
    if (!this.drafter.available) {
      throw new ChangeStacksUnavailableError();
    }

    const id = ChangeStackId.of(this.ids.generate());
    const { diff, sources } = this.reader.read(input.diff);
    const index = await this.indexOf(id, sources);

    const stack = ChangeStack.draft({
      id,
      runId: run.id,
      taskId: run.taskId,
      replay: run.replay,
      workspaceId: run.workspaceId,
      repository: input.repository,
      base: input.base,
      diff,
      facts: StackFacts.of(factsOf(diff, this.reading, index)),
      request: input.request,
      now: this.clock.now(),
    });

    await this.stacks.add(stack);

    return stack;
  }

  private async indexOf(
    id: ChangeStackId,
    sources: DiffSources,
  ): Promise<SymbolIndex> {
    try {
      return await this.indexer.index(sources);
    } catch (error) {
      this.logger.warn(
        { changeStackId: id.value, error },
        'The changed code could not be indexed; drafting from the diff alone',
      );
      return NO_INDEX;
    }
  }

  async drafted(stack: ChangeStack): Promise<ChangeStack> {
    const { diff, facts } = stack;

    if (facts.hunks.every((each) => each.incidental)) {
      return stack.propose([], this.clock.now());
    }

    let problems: readonly StackProblem[] = [];
    let drafting = stack;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const attempt = await attemptDrafting(this.drafter, {
        diff,
        repository: stack.repository,
        facts,
        problems,
      });

      if (!attempt.drafted) {
        this.logger.error(
          { changeStackId: stack.id.value, error: attempt.error },
          'Drafting a change stack failed; trying again later',
        );
        return drafting
          .usedModel(attempt.usage)
          .triedAgainLater(this.clock.now());
      }

      const { cohorts, usage } = attempt.answer;
      drafting = drafting.usedModel(usage);

      try {
        return drafting.propose(cohorts, this.clock.now());
      } catch (error) {
        if (!(error instanceof InvalidChangeStackError)) {
          throw error;
        }
        problems = error.problems;
      }
    }

    this.logger.warn(
      {
        changeStackId: stack.id.value,
        problems: problems.map((each) => each.message),
      },
      'A drafted change stack kept breaking its rules',
    );

    return drafting.fail(
      'The drafted stack did not place every change in order.',
      this.clock.now(),
    );
  }
}
