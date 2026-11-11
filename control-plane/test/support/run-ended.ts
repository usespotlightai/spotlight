import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import {
  type RunState,
  TERMINAL_RUN_STATES,
} from '@runs/domain/value-objects/run-state';

import { requestedBySpec, requestedByTask } from './runs';
import * as schema from './schema';

const endedAtFor = (state: RunState, at = new Date()): Date | null =>
  (TERMINAL_RUN_STATES as readonly RunState[]).includes(state) ? at : null;

export const endingFor = (state: RunState, at = new Date()) => ({
  endedAt: endedAtFor(state, at),
  ...(state === 'completed' || state === 'suspended'
    ? { exitCode: 0 }
    : state === 'failed'
      ? { exitCode: 1, failure: 'exited' as const, detail: 'It exited.' }
      : state === 'cancelled'
        ? {
            exitCode: -1,
            failure: 'cancelled' as const,
            detail: 'It was cancelled.',
          }
        : {}),
});

export const aRunOf = async (
  db: DrizzleDatabase,
  run: {
    readonly id: string;
    readonly workspaceId: string;
    readonly taskId?: string | null;
    readonly state?: RunState;
  },
): Promise<string> => {
  const state = run.state ?? 'claimed';

  await db.insert(schema.run).values({
    id: run.id,
    workspaceId: run.workspaceId,
    harness: 'dev',
    ...(run.taskId ? requestedByTask(run.taskId) : requestedBySpec(run.id)),
    state,
    ...endingFor(state),
    spec: {
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'do the thing',
      handover: { options: ['Spec'], noteLimit: 4_000 },
      resume: {},
    },
  });

  return run.id;
};
