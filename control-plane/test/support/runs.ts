import type { BriefedMemoriesParts } from '@work/domain/value-objects/briefed-memories.vo';
import type { BriefedTaskParts } from '@work/domain/value-objects/briefed-task.vo';
import type { StationConfigParts } from '@work/domain/value-objects/station-config.vo';
import type { dispatch } from '@work/infrastructure/persistence/drizzle/schemas/dispatch.schema';

type DispatchRow = typeof dispatch.$inferInsert;

interface Configured {
  readonly workspaceId?: string;
  readonly teamId?: string | null;
  readonly fingerprint?: string | null;
  readonly config?: StationConfigParts | null;
  readonly briefedTask?: BriefedTaskParts | null;
  readonly briefing?: string | null;
  readonly briefedMemories?: BriefedMemoriesParts;
  readonly orderedAt?: Date;
  readonly endedAt?: Date | null;
  readonly outcome?: DispatchRow['outcome'];
  readonly failure?: string | null;
}

const configured = (input: Configured) => ({
  workspaceId: input.workspaceId ?? 'ws_1',
  teamId: input.teamId ?? null,
  stationFingerprint: input.fingerprint ?? null,
  stationConfig: input.config ?? null,
  briefedTask: input.briefedTask ?? null,
  briefing: input.briefing ?? null,
  briefedMemories: input.briefedMemories ?? { briefed: [], omitted: [] },
  orderedAt: input.orderedAt ?? new Date(),
  enqueued: true,
  endedAt: input.endedAt ?? null,
  outcome: input.endedAt ? (input.outcome ?? 'completed') : null,
  failure: input.failure ?? null,
});

export const aDispatch = (
  input: Configured & {
    readonly runId: string;
    readonly taskId?: string;
    readonly revision?: number;
    readonly stationId?: string;
    readonly chatId?: string;
    readonly superseded?: boolean;
  },
): DispatchRow => {
  const superseded = input.superseded ?? false;
  const ending = superseded
    ? {
        endedAt: input.endedAt ?? input.orderedAt ?? new Date(),
        outcome: 'failed' as const,
        failure: input.failure ?? 'exited',
      }
    : {};

  return {
    id: input.runId,
    ...configured({ ...input, ...ending }),
    ...(input.chatId
      ? { kind: 'chat' as const, chatId: input.chatId }
      : {
          kind: 'task' as const,
          taskId: input.taskId,
          taskRevision: input.revision ?? 0,
          stationId: input.stationId,
        }),
    detachedAt: superseded ? ending.endedAt : null,
    superseded,
  };
};

export const aTrial = (
  input: Configured & {
    readonly runId: string;
    readonly basedOn: string;
    readonly taskId: string;
    readonly stationId: string;
    readonly asOf?: Date | null;
    readonly repositories?: readonly {
      readonly path: string;
      readonly repository: string;
    }[];
  },
): DispatchRow => ({
  id: input.runId,
  ...configured(input),
  enqueued: false,
  kind: 'trial',
  basedOnRunId: input.basedOn,
  taskId: input.taskId,
  stationId: input.stationId,
  asOf: input.asOf ?? null,
  trialRepositories: [...(input.repositories ?? [])],
});
