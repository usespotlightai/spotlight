import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UntrialableReason } from '@work/domain/value-objects/untrialable-reason';

export type TrialArchive = 'none' | 'stored' | 'gone';

export interface TrialFacts {
  readonly inWorkspace: boolean;
  readonly taskId: TaskId | null;
  readonly stationId: StationId | null;
  readonly ended: boolean;
  readonly startedFrom: boolean;
  readonly archive: TrialArchive;
  readonly briefed: boolean;
  readonly taskExists: boolean;
}

export type TrialAnswer = 'not-asked' | 'present' | 'gone';

export interface TrialInputs {
  readonly filesStored: boolean;
  readonly answer: TrialAnswer;
}

export interface TrialBlock {
  readonly reason: UntrialableReason;
  readonly description: string;
}

export const trialBlockOf = (facts: TrialFacts | null): TrialBlock | null => {
  if (!facts?.inWorkspace) {
    return {
      reason: 'unknown-run',
      description: 'The run is not in this workspace.',
    };
  }
  if (!facts.taskId || !facts.stationId) {
    return {
      reason: 'not-a-task-run',
      description: 'It did not work a task of its own.',
    };
  }
  if (!facts.ended) {
    return { reason: 'still-running', description: 'It has not ended yet.' };
  }
  if (!facts.startedFrom) {
    return {
      reason: 'no-starting-point',
      description: 'It never reported a starting point.',
    };
  }
  if (!facts.briefed) {
    return {
      reason: 'no-briefing',
      description: 'Its task briefing was not stored.',
    };
  }
  if (!facts.taskExists) {
    return { reason: 'task-gone', description: 'Its task was deleted.' };
  }
  if (facts.archive === 'gone') {
    return {
      reason: 'archive-gone',
      description:
        'The workspace archive that it started from is no longer stored.',
    };
  }

  return null;
};

export const trialInputsBlockOf = (inputs: TrialInputs): TrialBlock | null => {
  if (!inputs.filesStored) {
    return {
      reason: 'attachments-gone',
      description: 'A file from its task briefing is no longer stored.',
    };
  }
  if (inputs.answer === 'gone') {
    return {
      reason: 'answer-gone',
      description:
        'The change people accepted or what they said is no longer there.',
    };
  }

  return null;
};
