import type { JournalStep } from '@runs/application/contracts/run-journal.contract';
import type {
  RunProgressFact,
  RunStateFact,
  RunTurnFact,
} from '@runs/application/ports/run-facts.port';
import type {
  Progress,
  RunProgressReading,
} from '@work/domain/value-objects/progress';
import type { StepKind } from '@work/domain/value-objects/step-kind';
import {
  type TaskRunState,
  taskRunStateOf,
} from '@work/domain/value-objects/task-run-state';
import type { TurnStatus } from '@work/domain/value-objects/turn-status';

const TASK_RUN_STATES: Record<
  RunStateFact,
  Exclude<TaskRunState, 'superseded'>
> = {
  queued: 'queued',
  claimed: 'claimed',
  suspended: 'suspended',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

const PROGRESSES: Record<RunProgressFact, Progress> = {
  queued: 'queued',
  'in-progress': 'in-progress',
  stopping: 'stopping',
};

const TURN_STATUSES: Record<RunTurnFact, TurnStatus> = {
  pending: 'pending',
  kept: 'kept',
};

const STEP_KINDS: Record<JournalStep['kind'], StepKind> = {
  message: 'message',
  thought: 'thought',
  tool: 'tool',
  planned: 'planned',
  hook: 'hook',
};

export const RunReadingMapper = {
  state(state: RunStateFact, superseded: boolean): TaskRunState {
    return taskRunStateOf(TASK_RUN_STATES[state], superseded);
  },

  progress(progress: RunProgressFact | null): Progress | null {
    return progress === null ? null : PROGRESSES[progress];
  },

  reading(
    facts: {
      readonly progress: RunProgressFact | null;
      readonly resumable: boolean;
    } | null,
  ): RunProgressReading | null {
    return facts === null
      ? null
      : {
          progress: RunReadingMapper.progress(facts.progress),
          resumable: facts.resumable,
        };
  },

  turn(turn: RunTurnFact | null): TurnStatus | null {
    return turn === null ? null : TURN_STATUSES[turn];
  },

  stepKind(kind: JournalStep['kind']): StepKind {
    return STEP_KINDS[kind];
  },
};
