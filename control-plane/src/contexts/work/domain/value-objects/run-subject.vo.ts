import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import type { ChatId } from '@work/domain/value-objects/chat-id.vo';
import type { SearchId } from '@work/domain/value-objects/search-id.vo';
import type { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { TaskRevision } from '@work/domain/value-objects/task-revision.vo';

export type RunSubjectKind = keyof RunSubjectCases<unknown>;

export const RUN_SUBJECT_KINDS = [
  'task',
  'chat',
  'replay',
  'search',
] as const satisfies readonly RunSubjectKind[];

export interface RunSubjectCases<T> {
  task(taskId: TaskId, stationId: StationId | null, revision: TaskRevision): T;
  chat(chatId: ChatId): T;
  replay(
    original: RunId,
    taskId: TaskId,
    stationId: StationId | null,
    teamId: TeamId,
  ): T;
  search(
    searchId: SearchId,
    iteration: SearchIteration,
    stationId: StationId | null,
    teamId: TeamId,
  ): T;
}

const same = <V extends { equals(other: V): boolean }>(
  a: V | null,
  b: V | null,
): boolean => (a === null ? b === null : b !== null && a.equals(b));

export class RunSubject {
  private constructor(
    readonly taskId: TaskId | null,
    readonly stationId: StationId | null,
    readonly chatId: ChatId | null,
    readonly revision: TaskRevision | null,
    readonly replayOf: RunId | null = null,
    readonly replayedTaskId: TaskId | null = null,
    readonly ranFor: TeamId | null = null,
    readonly searchId: SearchId | null = null,
    readonly iteration: SearchIteration | null = null,
  ) {}

  static task(
    taskId: TaskId,
    stationId: StationId | null,
    revision: TaskRevision,
  ): RunSubject {
    return new RunSubject(taskId, stationId, null, revision);
  }

  static chat(chatId: ChatId): RunSubject {
    return new RunSubject(null, null, chatId, null);
  }

  static replay(
    original: RunId,
    taskId: TaskId,
    stationId: StationId,
    teamId: TeamId,
  ): RunSubject {
    return new RunSubject(
      null,
      stationId,
      null,
      null,
      original,
      taskId,
      teamId,
    );
  }

  static search(
    searchId: SearchId,
    iteration: SearchIteration,
    stationId: StationId | null,
    teamId: TeamId,
  ): RunSubject {
    return new RunSubject(
      null,
      stationId,
      null,
      null,
      null,
      null,
      teamId,
      searchId,
      iteration,
    );
  }

  static rehydrate(input: {
    taskId: TaskId | null;
    stationId: StationId | null;
    chatId: ChatId | null;
    revision: TaskRevision | null;
    replayOf?: RunId | null;
    replayedTaskId?: TaskId | null;
    ranFor?: TeamId | null;
    searchId?: SearchId | null;
    iteration?: SearchIteration | null;
  }): RunSubject | null {
    const replayOf = input.replayOf ?? null;
    const replayedTaskId = input.replayedTaskId ?? null;
    const ranFor = input.ranFor ?? null;
    const searchId = input.searchId ?? null;
    const iteration = input.iteration ?? null;

    if (searchId || iteration) {
      if (
        input.taskId ||
        input.chatId ||
        input.revision ||
        replayOf ||
        replayedTaskId
      ) {
        throw new InconsistentStateError(
          'run',
          'searches while it works a task, chat or replay of its own',
        );
      }
      if (!searchId || !iteration || !ranFor) {
        throw new InconsistentStateError(
          'run',
          'searches without naming the search, its iteration and the team it searches for',
        );
      }

      return RunSubject.search(searchId, iteration, input.stationId, ranFor);
    }

    if (replayOf || replayedTaskId || ranFor) {
      if (input.taskId || input.chatId || input.revision) {
        throw new InconsistentStateError(
          'run',
          'replays a run while it works a task or chat of its own',
        );
      }
      if (!replayOf || !replayedTaskId || !ranFor) {
        throw new InconsistentStateError(
          'run',
          'replays a run without naming it, its task and the team it replays for',
        );
      }

      return new RunSubject(
        null,
        input.stationId,
        null,
        null,
        replayOf,
        replayedTaskId,
        ranFor,
      );
    }
    if (input.chatId && (input.taskId || input.stationId)) {
      throw new InconsistentStateError(
        'run',
        'works a chat and a task at once',
      );
    }
    if (input.chatId) {
      return RunSubject.chat(input.chatId);
    }
    if (input.taskId && input.revision === null) {
      throw new InconsistentStateError(
        'run',
        'works a task without the revision it was handed',
      );
    }
    if (input.taskId && input.revision) {
      return RunSubject.task(input.taskId, input.stationId, input.revision);
    }
    if (input.stationId) {
      throw new InconsistentStateError(
        'run',
        'stands at a station with no task',
      );
    }

    return null;
  }

  get isReplay(): boolean {
    return this.replayOf !== null;
  }

  get isSearch(): boolean {
    return this.searchId !== null;
  }

  get leavesNothingBehind(): boolean {
    return this.isReplay || this.isSearch;
  }

  get archiveHolder(): ArchiveHolder | null {
    if (this.chatId) {
      return { kind: 'chat', chatId: this.chatId };
    }

    return this.taskId ? { kind: 'task', taskId: this.taskId } : null;
  }

  match<T>(cases: RunSubjectCases<T>): T {
    if (this.searchId) {
      return cases.search(
        this.searchId,
        this.iteration as SearchIteration,
        this.stationId,
        this.ranFor as TeamId,
      );
    }

    if (this.replayOf) {
      return cases.replay(
        this.replayOf,
        this.replayedTaskId as TaskId,
        this.stationId,
        this.ranFor as TeamId,
      );
    }

    return this.chatId
      ? cases.chat(this.chatId)
      : cases.task(
          this.taskId as TaskId,
          this.stationId,
          this.revision as TaskRevision,
        );
  }

  equals(other: RunSubject): boolean {
    return (
      same(this.taskId, other.taskId) &&
      same(this.stationId, other.stationId) &&
      same(this.chatId, other.chatId) &&
      same(this.revision, other.revision) &&
      same(this.replayOf, other.replayOf) &&
      same(this.replayedTaskId, other.replayedTaskId) &&
      same(this.ranFor, other.ranFor) &&
      same(this.searchId, other.searchId) &&
      same(this.iteration, other.iteration)
    );
  }
}
