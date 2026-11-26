import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { repositoriesReviewedOrAll } from '@work/domain/services/task-checkouts';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
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

type TrialAnswer = 'not-asked' | 'present' | 'gone';

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
        'The working copy archive that it started from is no longer stored.',
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

export interface TrialCheckoutFact {
  readonly checkedOutAt: string;
  readonly repository: Repository | null;
}

/** What a run checked out, held against the repositories a run of its task checks out on a line. */
export interface TrialRepositories {
  readonly checkouts: readonly TrialCheckoutFact[];
  readonly reviewing: Repository | null;
  readonly line: LineMap;
}

export const trialRepositoriesBlockOf = ({
  checkouts,
  reviewing,
  line,
}: TrialRepositories): TrialBlock | null => {
  const repositories = repositoriesReviewedOrAll(reviewing, line);
  const isOf = (checkout: TrialCheckoutFact, repository: Repository) =>
    checkout.repository?.equals(repository) ?? false;
  const gone = checkouts.find(
    (each) => !repositories.some((repository) => isOf(each, repository)),
  );

  if (gone) {
    return {
      reason: 'repository-gone',
      description: `The line no longer has repository ${gone.checkedOutAt}.`,
    };
  }

  const missing = repositories.find(
    (repository) => !checkouts.some((each) => isOf(each, repository)),
  );

  if (missing) {
    return {
      reason: 'repository-missing',
      description: `It ran without repository ${missing.value}, which the line has now.`,
    };
  }

  return null;
};

/**
 * Whether a run can be picked for trials on its station's line as it is now.
 * `onLine` is null where the run's line is not known; a trial plan checks the
 * candidate's repositories again when a trial is ordered.
 */
export const trialBlockOnLineOf = (
  facts: TrialFacts | null,
  onLine: TrialRepositories | null,
): TrialBlock | null =>
  trialBlockOf(facts) ?? (onLine ? trialRepositoriesBlockOf(onLine) : null);
