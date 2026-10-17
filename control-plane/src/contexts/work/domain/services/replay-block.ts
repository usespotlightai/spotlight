import type { UnreplayableReason } from '@work/domain/exceptions/unreplayable-run.error';

export interface ReplayFacts {
  readonly runId: string;
  readonly taskId: string | null;
  readonly stationId: string | null;
  readonly inWorkspace: boolean;
  readonly ended: boolean;
  readonly startedFrom: boolean;
  readonly archive: 'none' | 'stored' | 'gone';
  readonly briefed: boolean;
  readonly taskExists: boolean;
}

export interface ReplayBlock {
  readonly unreplayableReason: UnreplayableReason;
  readonly reason: string;
}

export const replayBlockOf = (
  facts: ReplayFacts | null,
): ReplayBlock | null => {
  if (!facts?.inWorkspace) {
    return {
      unreplayableReason: 'unknown-run',
      reason: 'The run is not in this workspace.',
    };
  }
  if (!facts.taskId || !facts.stationId) {
    return {
      unreplayableReason: 'not-a-task-run',
      reason: 'It did not work a task of its own.',
    };
  }
  if (!facts.ended) {
    return {
      unreplayableReason: 'still-running',
      reason: 'It has not ended yet.',
    };
  }
  if (!facts.startedFrom) {
    return {
      unreplayableReason: 'no-starting-point',
      reason: 'It never reported a starting point.',
    };
  }
  if (!facts.briefed) {
    return {
      unreplayableReason: 'no-briefing',
      reason: 'Its task briefing was not stored.',
    };
  }
  if (!facts.taskExists) {
    return { unreplayableReason: 'task-gone', reason: 'Its task was deleted.' };
  }
  if (facts.archive === 'gone') {
    return {
      unreplayableReason: 'archive-gone',
      reason: 'The workspace archive that it started from is no longer stored.',
    };
  }

  return null;
};
