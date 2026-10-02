import type { ReplayRefusal } from '@work/domain/exceptions/unreplayable-run.error';

export interface ReplayFacts {
  readonly runId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly inWorkspace: boolean;
  readonly ended: boolean;
  readonly startedFrom: boolean;
  readonly archive: 'none' | 'kept' | 'gone';
  readonly briefed: boolean;
  readonly taskStands: boolean;
}

export interface ReplayStanding {
  readonly refusal: ReplayRefusal;
  readonly reason: string;
}

export const standingOf = (
  facts: ReplayFacts | null,
): ReplayStanding | null => {
  if (!facts?.inWorkspace) {
    return { refusal: 'unknown-run', reason: 'there is no such run' };
  }
  if (!facts.taskId || !facts.stationId) {
    return {
      refusal: 'not-a-task-run',
      reason: 'it worked no task of its own',
    };
  }
  if (!facts.ended) {
    return { refusal: 'still-running', reason: 'it has not ended yet' };
  }
  if (!facts.startedFrom) {
    return {
      refusal: 'no-starting-point',
      reason: 'it never said where it started',
    };
  }
  if (!facts.briefed) {
    return {
      refusal: 'no-briefing',
      reason: 'the task it was briefed with was never kept',
    };
  }
  if (!facts.taskStands) {
    return { refusal: 'task-gone', reason: 'the task it worked was deleted' };
  }
  if (facts.archive === 'gone') {
    return {
      refusal: 'archive-gone',
      reason: 'the workspace archive it started from is no longer kept',
    };
  }

  return null;
};
