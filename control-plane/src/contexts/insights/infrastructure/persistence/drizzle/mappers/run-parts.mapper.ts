import type { CheckVerdict } from '@insights/domain/value-objects/check-verdict';
import { Dismissal } from '@insights/domain/value-objects/dismissal.vo';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import { RunActions } from '@insights/domain/value-objects/run-actions.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunChecks } from '@insights/domain/value-objects/run-checks.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { RunMemories } from '@insights/domain/value-objects/run-memories.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { StationPass } from '@insights/domain/value-objects/station-pass.vo';
import type {
  runRecord,
  StoredRepositoryCheck,
  StoredTools,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { LatencyHistogram } from '@shared-kernel/domain/value-objects/latency-histogram.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export type RunPartsRow = Omit<
  typeof runRecord.$inferSelect,
  'runId' | 'workspaceId' | 'version' | 'repositoryChecks'
>;

export interface RunParts {
  readonly taskId: TaskId | null;
  readonly end: RunEnd | null;
  readonly supersededAt: Date | null;
  readonly asked: boolean;
  readonly checks: CheckVerdict | null;
  readonly checkedAt: Date | null;
  readonly actions: RunActions;
  readonly approvalAnsweredAt: Date | null;
  readonly usage: RunUsage | null;
  readonly passed: StationPass | null;
  readonly tools: RunTools | null;
  readonly dismissals: readonly Dismissal[];
  readonly memories: RunMemories;
}

export type StoredRunParts = 'run record' | 'run fact';

const spentOf = (
  row: RunPartsRow,
  stored: StoredRunParts,
): { queuedMs: number; runningMs: number } => {
  if (row.startedAt === null) {
    return { queuedMs: 0, runningMs: 0 };
  }
  if (row.queuedMs === null || row.runningMs === null) {
    throw new InconsistentStateError(
      stored,
      'started without saying how long it queued and ran',
    );
  }

  return { queuedMs: row.queuedMs, runningMs: row.runningMs };
};

export const endOf = (
  row: RunPartsRow,
  stored: StoredRunParts,
): RunEnd | null => {
  if (!row.endedAt) {
    return null;
  }
  if (
    !nonEmpty(row.teamId) ||
    !nonEmpty(row.lineId) ||
    !nonEmpty(row.stationId) ||
    !nonEmpty(row.taskId) ||
    !row.ending ||
    !nonEmpty(row.harness) ||
    !row.repositories ||
    !row.skills ||
    row.runNumber === null
  ) {
    throw new InconsistentStateError(
      stored,
      'ended without saying where, how, or with which run number',
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
    ...spentOf(row, stored),
    ending: row.ending,
    failure: row.failure,
    runNumber: row.runNumber,
  });
};

export const decidingActionOf = (
  {
    decidingAction,
    decidingActionAt,
    decidingActionBy,
  }: Pick<
    RunPartsRow,
    'decidingAction' | 'decidingActionAt' | 'decidingActionBy'
  >,
  stored: StoredRunParts,
): PersonAction | null => {
  if (
    decidingAction === null &&
    decidingActionAt === null &&
    decidingActionBy === null
  ) {
    return null;
  }

  if (
    decidingAction === null ||
    decidingActionAt === null ||
    decidingActionBy === null
  ) {
    throw new InconsistentStateError(
      stored,
      'has only part of its deciding action: the action, its time and who acted go together',
    );
  }

  return PersonAction.of(
    decidingAction,
    decidingActionAt,
    UserId.of(decidingActionBy),
  );
};

export const answerOf = (
  { answeredAt, answeredBy }: Pick<RunPartsRow, 'answeredAt' | 'answeredBy'>,
  stored: StoredRunParts,
): PersonAction | null => {
  if ((answeredAt === null) !== (answeredBy === null)) {
    throw new InconsistentStateError(
      stored,
      'has only part of its answer: when it was answered and who answered go together',
    );
  }

  return answeredAt && nonEmpty(answeredBy)
    ? PersonAction.of('answered', answeredAt, UserId.of(answeredBy))
    : null;
};

export const usageOf = (
  row: RunPartsRow,
  stored: StoredRunParts,
): RunUsage | null => {
  if (!row.usageRecorded) {
    return null;
  }
  if (row.steps === null || row.errors === null || row.changedLines === null) {
    throw new InconsistentStateError(
      stored,
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

export const checkedOf = (row: {
  readonly repositoryChecks: readonly StoredRepositoryCheck[];
}): RunChecks =>
  RunChecks.of(
    row.repositoryChecks.map((each) => ({
      repository: each.repository,
      stackStartedAt: new Date(each.stackStartedAt),
      verdict: each.verdict,
      checkedAt: new Date(each.checkedAt),
    })),
  );

export const checkedColumnOf = (record: {
  readonly checked: RunChecks;
}): StoredRepositoryCheck[] =>
  record.checked.repositories.map((each) => ({
    repository: each.repository,
    stackStartedAt: each.stackStartedAt.toISOString(),
    verdict: each.verdict,
    checkedAt: each.checkedAt.toISOString(),
  }));

export const memoriesOf = (row: RunPartsRow): RunMemories =>
  RunMemories.of({
    briefed: row.memories.briefed,
    cut: row.memories.cut,
    read: row.memories.read,
    recalled: row.memories.recalled,
    delivered: row.memories.delivered,
  });

export const passOf = (
  row: RunPartsRow,
  stored: StoredRunParts,
): StationPass | null => {
  if ((row.passedTo === null) !== (row.passedAt === null)) {
    throw new InconsistentStateError(
      stored,
      'was passed on without saying where or when',
    );
  }

  return nonEmpty(row.passedTo) && row.passedAt
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
    queuedMs: end?.queuedMs ?? null,
    runningMs: end?.runningMs ?? null,
    ending: end?.ending ?? null,
    failure: end?.failure ?? null,
    runNumber: end?.runNumber ?? null,
    asked: record.asked,
    supersededAt: record.supersededAt,
    decidingAction: record.actions.decidingAction?.decidingKind ?? null,
    decidingActionAt: record.actions.decidingAction?.at ?? null,
    decidingActionBy: record.actions.decidingAction?.by.value ?? null,
    answeredAt: record.actions.answer?.at ?? null,
    answeredBy: record.actions.answer?.by.value ?? null,
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
      cut: [...record.memories.cut],
      read: [...record.memories.read],
      recalled: [...record.memories.recalled],
      delivered: [...record.memories.delivered],
      cutThenRead: [...record.memories.cutThenRead],
      used: record.memories.used,
    },
  };
};

export const actionsOf = (
  row: Pick<
    RunPartsRow,
    | 'decidingAction'
    | 'decidingActionAt'
    | 'decidingActionBy'
    | 'answeredAt'
    | 'answeredBy'
  >,
  stored: StoredRunParts,
): RunActions =>
  RunActions.of({
    decidingAction: decidingActionOf(row, stored),
    answer: answerOf(row, stored),
  });
