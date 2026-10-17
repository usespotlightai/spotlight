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
  readonly taskExists: boolean;
}

export interface ReplayBlock {
  readonly refusal: ReplayRefusal;
  readonly reason: string;
}

export const replayBlockOf = (
  facts: ReplayFacts | null,
): ReplayBlock | null => {
  if (!facts?.inWorkspace) {
    return {
      refusal: 'unknown-run',
      reason: 'The run is not in this workspace.',
    };
  }
  if (!facts.taskId || !facts.stationId) {
    return {
      refusal: 'not-a-task-run',
      reason: 'It did not work a task of its own.',
    };
  }
  if (!facts.ended) {
    return { refusal: 'still-running', reason: 'It has not ended yet.' };
  }
  if (!facts.startedFrom) {
    return {
      refusal: 'no-starting-point',
      reason: 'It never reported a starting point.',
    };
  }
  if (!facts.briefed) {
    return {
      refusal: 'no-briefing',
      reason: 'Its task briefing was not kept.',
    };
  }
  if (!facts.taskExists) {
    return { refusal: 'task-gone', reason: 'Its task was deleted.' };
  }
  if (facts.archive === 'gone') {
    return {
      refusal: 'archive-gone',
      reason: 'The workspace archive that it started from is no longer kept.',
    };
  }

  return null;
};
