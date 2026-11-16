import { ChangeStacksUnavailableError } from '@change-review/application/errors/change-stacks-unavailable.error';
import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import type { ChangeStackLocksPort } from '@change-review/application/ports/change-stack-locks.port';
import type {
  DiffReaderPort,
  DiffSources,
  ReadDiff,
} from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import {
  combined,
  exceedsOneCall,
  layerCohort,
  layeredInRounds,
} from '@change-review/application/services/cohort-layering';
import {
  ATTEMPTS,
  attempted,
  settleBroken,
  settleUnanswered,
} from '@change-review/application/services/generation-attempt';
import { withRenewedLease } from '@change-review/application/services/job-lease';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import {
  InvalidChangeStackError,
  type StackProblem,
} from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { CodeReading } from '@change-review/domain/services/code-reading';
import { factsOf } from '@change-review/domain/services/diff-facts';
import { StackOutline } from '@change-review/domain/services/stack-outline';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type { OutlinedCohort } from '@change-review/domain/value-objects/stack-cohort.vo';
import { StackFacts } from '@change-review/domain/value-objects/stack-facts.vo';
import type { StackOrigin } from '@change-review/domain/value-objects/stack-origin.vo';
import {
  NO_INDEX,
  type SymbolIndex,
} from '@change-review/domain/value-objects/symbol-index.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface StackSource {
  readonly origin: StackOrigin;
  readonly taskId: TaskId | null;
  readonly teamOfRun: TeamId | null;
  readonly trial: boolean;
  readonly checkouts: number;
  readonly workspaceId: WorkspaceId;
}

export interface PreparedStack {
  readonly id: ChangeStackId;
  readonly source: StackSource;
  readonly input: StackInput;
  readonly diff: ReadDiff['diff'];
  readonly index: SymbolIndex;
}

export interface StackInput {
  readonly diff: string;
  readonly repository: string | null;
  readonly base: string | null;
  readonly request: CheckRequest | null;
}

export class GenerateChangeStack {
  constructor(
    private readonly stacks: ChangeStackRepository,
    private readonly generator: ChangeStackGeneratorPort,
    private readonly reader: DiffReaderPort,
    private readonly reading: CodeReading,
    private readonly indexer: SymbolIndexerPort,
    private readonly locks: ChangeStackLocksPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async begin(source: StackSource, input: StackInput): Promise<ChangeStack> {
    const prepared = await this.prepare(source, input);
    const { taskId } = source;

    if (!taskId) {
      return this.start(prepared, []);
    }

    return this.locks.stackingFor(taskId, async () =>
      this.start(prepared, await this.stacks.ofTask(taskId)),
    );
  }

  async prepare(
    source: StackSource,
    input: StackInput,
  ): Promise<PreparedStack> {
    const id = ChangeStackId.of(this.ids.generate());
    const { diff, sources } = this.reader.read(input.diff);
    const index = await this.indexOf(id, sources);

    return { id, source, input, diff, index };
  }

  async start(
    prepared: PreparedStack,
    taskStacks: readonly ChangeStack[],
  ): Promise<ChangeStack> {
    const { source, input } = prepared;
    const stack = ChangeStack.startGeneration({
      id: prepared.id,
      origin: source.origin,
      taskId: source.taskId,
      teamOfRun: source.teamOfRun,
      trial: source.trial,
      checkouts: source.checkouts,
      workspaceId: source.workspaceId,
      repository: input.repository,
      base: input.base,
      diff: prepared.diff,
      facts: StackFacts.of(
        factsOf(prepared.diff, this.reading, prepared.index),
      ),
      request: input.request,
      taskStacks,
      now: this.clock.now(),
    });

    if (!(await this.generator.availableTo(run.workspaceId.value))) {
      this.logger.debug(
        { workspaceId: run.workspaceId.value },
        'No model endpoint is set for the workspace; change stacks are unavailable',
      );
      throw new ChangeStacksUnavailableError();
    }

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
        'The changed code could not be indexed; generating from the diff alone',
      );
      return NO_INDEX;
    }
  }

  async generated(stack: ChangeStack): Promise<ChangeStack> {
    const previous = stack.previous
      ? await this.stacks.find(stack.previous)
      : null;

    if (!stack.needsModel) {
      return stack.propose([], this.clock.now(), { previous });
    }

    const reused = previous && stack.reusedFrom(previous, this.clock.now());

    if (reused) {
      return reused;
    }

    return exceedsOneCall(stack.diff, stack.facts)
      ? this.split(stack, previous)
      : this.whole(stack, previous);
  }

  private async whole(
    stack: ChangeStack,
    previous: ChangeStack | null,
  ): Promise<ChangeStack> {
    const basis = stack.previousStack(previous);
    const { diff, facts } = stack;
    let problems: readonly StackProblem[] = [];
    let generating = stack;

    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const attempt = await attempted(() =>
        this.generator.generate({
          workspaceId: stack.workspaceId.value,
          diff,
          repository: stack.repository,
          facts,
          problems,
          previous: basis,
        }),
      );

      if (!attempt.generated) {
        return settleUnanswered(
          generating.recordModel(attempt.usage),
          attempt,
          this.clock.now(),
          this.logger,
        );
      }

      const { cohorts, usage } = attempt.answer;
      generating = generating.recordModel(usage);

      try {
        return generating.propose(cohorts, this.clock.now(), { previous });
      } catch (error) {
        if (!(error instanceof InvalidChangeStackError)) {
          throw error;
        }
        problems = error.problems;
      }
    }

    return settleBroken(generating, problems, this.clock.now(), this.logger);
  }

  private async split(
    stack: ChangeStack,
    previous: ChangeStack | null,
  ): Promise<ChangeStack> {
    const basis = stack.previousStack(previous);
    const { diff, facts } = stack;
    let problems: readonly StackProblem[] = [];
    let generating = stack;
    let outline: readonly OutlinedCohort[] | null = null;

    for (let attempt = 1; !outline && attempt <= ATTEMPTS; attempt += 1) {
      const attempt = await attempted(() =>
        this.generator.outline({
          workspaceId: stack.workspaceId.value,
          diff,
          repository: stack.repository,
          facts,
          problems,
          previous: basis,
        }),
      );

      if (!attempt.generated) {
        return settleUnanswered(
          generating.recordModel(attempt.usage),
          attempt,
          this.clock.now(),
          this.logger,
        );
      }

      generating = generating.recordModel(attempt.answer.usage);

      try {
        outline = StackOutline.validate({
          diff,
          facts,
          cohorts: attempt.answer.cohorts,
        });
      } catch (error) {
        if (!(error instanceof InvalidChangeStackError)) {
          throw error;
        }
        problems = error.problems;
      }
    }

    if (!outline) {
      return settleBroken(generating, problems, this.clock.now(), this.logger);
    }

    const layered = combined(
      await layeredInRounds(
        outline.map(
          (cohort) => () =>
            layerCohort(this.generator, {
              workspaceId: stack.workspaceId.value,
              diff,
              facts,
              repository: stack.repository,
              cohort,
              previous: basis,
            }),
        ),
        {
          before: async () => {
            generating = await withRenewedLease(
              this.stacks,
              generating,
              this.clock.now(),
            );
          },
          after: (round) => {
            for (const call of round.flatMap((each) => each.usage)) {
              generating = generating.recordModel(call);
            }
          },
        },
      ),
    );

    if (layered.outcome === 'unanswered') {
      return settleUnanswered(
        generating,
        layered,
        this.clock.now(),
        this.logger,
      );
    }
    if (layered.outcome === 'broken') {
      return settleBroken(
        generating,
        layered.problems,
        this.clock.now(),
        this.logger,
      );
    }

    try {
      return generating.propose(layered.cohorts, this.clock.now(), {
        modelProposal: layered.proposed,
        previous,
      });
    } catch (error) {
      if (!(error instanceof InvalidChangeStackError)) {
        throw error;
      }
      return settleBroken(
        generating,
        error.problems,
        this.clock.now(),
        this.logger,
      );
    }
  }
}
