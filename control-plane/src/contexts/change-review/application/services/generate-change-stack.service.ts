import type { ChangeStackGeneratorPort } from '@change-review/application/ports/change-stack-generator.port';
import type { ChangeStackLocksPort } from '@change-review/application/ports/change-stack-locks.port';
import type {
  DiffReaderPort,
  DiffSources,
  ReadDiff,
} from '@change-review/application/ports/diff-reader.port';
import type { SymbolIndexerPort } from '@change-review/application/ports/symbol-indexer.port';
import { drafted } from '@change-review/application/services/stack-drafting';
import { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { CodeReading } from '@change-review/domain/services/code-reading';
import { factsOf } from '@change-review/domain/services/diff-facts';
import { sessionRunFor } from '@change-review/domain/services/session-run';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
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
  readonly owner: string;
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
      owner: input.owner,
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

    const basis = sessionRunFor(
      stack,
      stack.taskId ? await this.stacks.ofTask(stack.taskId) : [],
    );

    if (!basis) {
      this.logger.warn(
        { changeStackId: stack.id.value, state: stack.state },
        'No run of the task can host the session drafting the change stack, so it is not generated',
      );
      return stack.stopUndrafted(this.clock.now());
    }

    return drafted(
      this.generator,
      stack,
      {
        workspaceId: stack.workspaceId.value,
        round: stack.draftingRound(),
        basedOnRun: basis,
        diff: stack.diff,
        repository: stack.repository,
        facts: stack.facts,
        problems: stack.problems,
        previous: stack.previousStack(previous),
      },
      (drafting, cohorts) =>
        drafting.propose(cohorts, this.clock.now(), { previous }),
      this.clock.now(),
      this.logger,
    );
  }
}
