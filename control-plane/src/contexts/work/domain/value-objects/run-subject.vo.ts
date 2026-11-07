import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { ArchiveHolder } from '@work/domain/value-objects/archive-holder.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';

export type RunSubjectKind = keyof RunSubjectCases<unknown>;

export type RunSubjectValues =
  | {
      readonly kind: 'task';
      readonly taskId: string;
      readonly stationId: string | null;
      readonly revision: number;
    }
  | { readonly kind: 'chat'; readonly chatId: string }
  | {
      readonly kind: 'replay';
      readonly replayOf: string;
      readonly taskId: string;
      readonly stationId: string;
      readonly teamId: string;
    }
  | {
      readonly kind: 'search';
      readonly searchId: string;
      readonly iteration: number;
      readonly stationId: string | null;
      readonly teamId: string;
    };

const stationOf = (id: string | null): StationId | null =>
  id ? StationId.of(id) : null;

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

  static fromValues(values: RunSubjectValues): RunSubject {
    switch (values.kind) {
      case 'task':
        return RunSubject.task(
          TaskId.of(values.taskId),
          stationOf(values.stationId),
          TaskRevision.of(values.revision),
        );
      case 'chat':
        return RunSubject.chat(ChatId.of(values.chatId));
      case 'replay':
        return RunSubject.replay(
          RunId.of(values.replayOf),
          TaskId.of(values.taskId),
          StationId.of(values.stationId),
          TeamId.of(values.teamId),
        );
      case 'search':
        return RunSubject.search(
          SearchId.of(values.searchId),
          SearchIteration.of(values.iteration),
          stationOf(values.stationId),
          TeamId.of(values.teamId),
        );
    }
  }

  get values(): RunSubjectValues {
    return this.match<RunSubjectValues>({
      task: (taskId, stationId, revision) => ({
        kind: 'task',
        taskId: taskId.value,
        stationId: stationId?.value ?? null,
        revision: revision.value,
      }),
      chat: (chatId) => ({ kind: 'chat', chatId: chatId.value }),
      replay: (original, taskId, stationId, teamId) => ({
        kind: 'replay',
        replayOf: original.value,
        taskId: taskId.value,
        stationId: (stationId as StationId).value,
        teamId: teamId.value,
      }),
      search: (searchId, iteration, stationId, teamId) => ({
        kind: 'search',
        searchId: searchId.value,
        iteration: iteration.value,
        stationId: stationId?.value ?? null,
        teamId: teamId.value,
      }),
    });
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
      throw new InconsistentStateError('run', 'is at a station with no task');
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
