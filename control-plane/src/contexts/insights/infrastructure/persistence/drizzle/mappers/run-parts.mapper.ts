import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import {
  HumanAction,
  TASK_ACTIONS,
  type TaskAction,
} from '@insights/domain/value-objects/human-action.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { RunMemories } from '@insights/domain/value-objects/run-memories.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import type {
  runRecord,
  StoredTools,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export type RunPartsRow = Omit<
  typeof runRecord.$inferSelect,
  'runId' | 'workspaceId' | 'version'
>;

export interface RunParts {
  readonly taskId: TaskId | null;
  readonly end: RunEnd | null;
  readonly supersededAt: Date | null;
  readonly checks: RunPartsRow['checks'];
  readonly checkedAt: Date | null;
  readonly firstHumanAction: HumanAction | null;
  readonly approvalAnsweredAt: Date | null;
  readonly usage: RunUsage | null;
  readonly passed: StationPass | null;
  readonly tools: RunTools | null;
  readonly dismissals: readonly Dismissal[];
  readonly memories: RunMemories;
}

export const endOf = (row: RunPartsRow): RunEnd | null => {
  if (!row.endedAt) {
    return null;
  }
  if (
    !row.teamId ||
    !row.lineId ||
    !row.stationId ||
    !row.taskId ||
    !row.ending ||
    !row.harness ||
    !row.repositories ||
    !row.skills ||
    row.visit === null
  ) {
    throw new InconsistentStateError(
      'run record',
      'ended without saying where, how, or in which visit',
    );
  }

  return RunEnd.of({
    location: RunLocation.of({
      teamId: TeamId.of(row.teamId),
      lineId: LineId.of(row.lineId),
      stationId: StationId.of(row.stationId),
      taskId: TaskId.of(row.taskId),
    }),
    fingerprint: row.fingerprint,
    agentConfig: RunAgentConfig.of({
      harness: row.harness,
      model: row.model,
      effort: row.effort,
      profileKey: row.profileKey,
      repositories: row.repositories,
      skills: row.skills,
    }),
    queuedAt: row.queuedAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    ending: row.ending,
    failure: row.failure,
    visit: row.visit,
    asked: row.asked,
  });
};

export const firstHumanActionOf = (row: RunPartsRow): HumanAction | null => {
  if ((row.firstHumanAction === null) !== (row.firstHumanActionAt === null)) {
    throw new InconsistentStateError(
      'run record',
      'has a first human action without a time, or a time without the action',
    );
  }

  if (!row.firstHumanAction || !row.firstHumanActionAt) {
    return null;
  }

  return HumanAction.of(row.firstHumanAction, row.firstHumanActionAt);
};

const firstHumanActionColumnOf = (
  action: HumanAction | null,
): TaskAction | null => {
  if (!action) {
    return null;
  }

  const kind = TASK_ACTIONS.find((each) => each === action.kind);

  if (!kind) {
    throw new InconsistentStateError(
      'run record',
      'was decided by answering an approval',
    );
  }

  return kind;
};

export const usageOf = (row: RunPartsRow): RunUsage | null => {
  if (!row.usageRecorded) {
    return null;
  }
  if (row.steps === null || row.errors === null || row.changedLines === null) {
    throw new InconsistentStateError(
      'run record',
      'recorded its usage without counting its steps, errors or changed lines',
    );
  }

  return RunUsage.of({
    ms: row.ms,
    steps: row.steps,
    errors: row.errors,
    changedLines: row.changedLines,
    contextTokens: row.contextTokens,
    contextWindow: row.contextWindow,
    amount: row.cost,
    currency: row.currency,
    tokens: {
      input: row.inputTokens,
      output: row.outputTokens,
      cacheRead: row.cacheReadTokens,
      cacheWrite: row.cacheWriteTokens,
    },
  });
};

export const toolsOf = (row: RunPartsRow): RunTools | null => {
  if (!row.usageRecorded) {
    return null;
  }

  return row.tools
    ? RunTools.of({
        servers: row.tools.servers.map((each) => ({
          ...each,
          latency: LatencyHistogram.of(each.latency),
        })),
        skillsRead: row.tools.skillsRead,
      })
    : RunTools.NONE;
};

const storedToolsOf = (tools: RunTools): StoredTools => ({
  servers: tools.servers.map((each) => ({
    server: each.server,
    calls: each.calls,
    failed: each.failed,
    latency: [...each.latency.counts],
    lastCallFailed: each.lastCallFailed,
  })),
  skillsRead: [...tools.skillsRead],
});

export const dismissalsOf = (row: RunPartsRow): readonly Dismissal[] =>
  row.dismissals.map((each) =>
    Dismissal.of({
      tool: each.tool,
      server: each.server,
      at: new Date(each.at),
    }),
  );

export const memoriesOf = (row: RunPartsRow): RunMemories =>
  RunMemories.of({
    briefed: row.memories.briefed,
    recalled: row.memories.recalled,
  });

export const passOf = (row: RunPartsRow): StationPass | null => {
  if ((row.passedTo === null) !== (row.passedAt === null)) {
    throw new InconsistentStateError(
      'run record',
      'was passed on without saying where or when',
    );
  }

  return row.passedTo && row.passedAt
    ? StationPass.of(StationId.of(row.passedTo), row.passedAt)
    : null;
};

export const partColumnsOf = (record: RunParts): RunPartsRow => {
  const end = record.end;

  return {
    teamId: end?.location.teamId.value ?? null,
    lineId: end?.location.lineId.value ?? null,
    stationId: end?.location.stationId.value ?? null,
    taskId: record.taskId?.value ?? null,
    fingerprint: end?.fingerprint ?? null,
    harness: end?.agentConfig.harness ?? null,
    model: end?.agentConfig.model ?? null,
    effort: end?.agentConfig.effort ?? null,
    profileKey: end?.agentConfig.profileKey ?? null,
    repositories: end ? [...end.agentConfig.repositories] : null,
    skills: end ? [...end.agentConfig.skills] : null,
    queuedAt: end?.queuedAt ?? null,
    startedAt: end?.startedAt ?? null,
    endedAt: end?.endedAt ?? null,
    ending: end?.ending ?? null,
    failure: end?.failure ?? null,
    visit: end?.visit ?? null,
    asked: end?.asked ?? false,
    supersededAt: record.supersededAt,
    checks: record.checks,
    checkedAt: record.checkedAt,
    firstHumanAction: firstHumanActionColumnOf(record.firstHumanAction),
    firstHumanActionAt: record.firstHumanAction?.at ?? null,
    approvalAnsweredAt: record.approvalAnsweredAt,
    passedTo: record.passed?.to.value ?? null,
    passedAt: record.passed?.at ?? null,
    usageRecorded: record.usage !== null,
    ms: record.usage?.ms ?? null,
    steps: record.usage?.steps ?? null,
    errors: record.usage?.errors ?? null,
    changedLines: record.usage?.changedLines ?? null,
    contextTokens: record.usage?.contextTokens ?? null,
    contextWindow: record.usage?.contextWindow ?? null,
    cost: record.usage?.spend?.amount ?? null,
    currency: record.usage?.spend?.currency ?? null,
    inputTokens: record.usage?.tokens.input ?? null,
    outputTokens: record.usage?.tokens.output ?? null,
    cacheReadTokens: record.usage?.tokens.cacheRead ?? null,
    cacheWriteTokens: record.usage?.tokens.cacheWrite ?? null,
    tools: record.tools ? storedToolsOf(record.tools) : null,
    dismissals: record.dismissals.map((each) => ({
      tool: each.tool,
      server: each.server,
      at: each.at.toISOString(),
    })),
    memories: {
      briefed: [...record.memories.briefed],
      recalled: [...record.memories.recalled],
    },
  };
};
