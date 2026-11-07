import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import {
  type RunState,
  TERMINAL_RUN_STATES,
} from '@runs/domain/value-objects/run-state';
import { requestedBySpec, requestedByTask } from './runs';
import * as schema from './schema';

export const endedAtFor = (state: RunState, at = new Date()): Date | null =>
  (TERMINAL_RUN_STATES as readonly RunState[]).includes(state) ? at : null;

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
    endedAt: endedAtFor(state),
    spec: {
      command: { executable: 'claude-agent-acp', args: [] },
      briefing: 'do the thing',
      handover: { options: ['Spec'], noteLimit: 4_000 },
      resume: {},
    },
  });

  return run.id;
};
