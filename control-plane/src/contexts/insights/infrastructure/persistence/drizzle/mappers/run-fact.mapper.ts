import { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import {
  dismissalsOf,
  endOf,
  actionsOf,
  personVerdictOf,
  memoriesOf,
  partColumnsOf,
  passOf,
  toolsOf,
  usageOf,
} from '@insights/infrastructure/persistence/drizzle/mappers/run-parts.mapper';
import type { runFact } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type RunFactRow = typeof runFact.$inferSelect;

const required = <T>(value: T | null): T => {
  if (value === null) {
    throw new InconsistentStateError(
      'run fact',
      'is missing a part of its end',
    );
  }

  return value;
};

export const rowOfFact = (fact: RunFact): RunFactRow => {
  const parts = partColumnsOf(fact);

  return {
    ...parts,
    checks: fact.checks,
    checkedAt: fact.checkedAt,
    runId: fact.runId.value,
    workspaceId: fact.workspaceId.value,
    teamId: required(parts.teamId),
    lineId: required(parts.lineId),
    stationId: required(parts.stationId),
    taskId: required(parts.taskId),
    harness: required(parts.harness),
    repositories: required(parts.repositories),
    skills: required(parts.skills),
    endedAt: fact.end.endedAt,
    beganAt: fact.end.beganAt,
    followedAt: fact.followedAt,
    endedAs: fact.end.ending,
    ending: fact.ending,
    resolution: fact.resolution,
    ran: fact.ran,
    ranAConfig: fact.end.ranAConfig,
    size: fact.size,
    runNumber: fact.end.runNumber,
    openedById: fact.opening?.by?.value ?? null,
    taskOpenedAt: fact.opening?.at ?? null,
    pullRequest: fact.pullRequest?.pullRequest.value ?? null,
    pullRequestState: fact.pullRequest?.state ?? null,
    pullRequestOpenedAt: fact.pullRequest?.openedAt ?? null,
    pullRequestClosedAt: fact.pullRequest?.closedAt ?? null,
  };
};

export const factOfRow = (row: RunFactRow): RunFact => {
  const parts = { ...row, ending: row.endedAs };

  return RunFact.of({
    runId: RunId.of(row.runId),
    workspaceId: WorkspaceId.of(row.workspaceId),
    end: required(endOf(parts, 'run fact')),
    supersededAt: row.supersededAt,
    followedAt: row.followedAt,
    asked: row.asked,
    checks: row.checks,
    checkedAt: row.checkedAt,
    actions: actionsOf(parts, 'run fact'),
    personVerdict: personVerdictOf(parts, 'run fact'),
    approvalAnsweredAt: row.approvalAnsweredAt,
    usage: usageOf(parts, 'run fact'),
    passed: passOf(parts, 'run fact'),
    tools: toolsOf(parts),
    dismissals: dismissalsOf(parts),
    memories: memoriesOf(parts),
    opening: row.taskOpenedAt
      ? {
          by: nonEmpty(row.openedById) ? UserId.of(row.openedById) : null,
          at: row.taskOpenedAt,
        }
      : null,
    pullRequest:
      nonEmpty(row.pullRequest) &&
      row.pullRequestState &&
      row.pullRequestOpenedAt
        ? {
            pullRequest: PullRequestUrl.of(row.pullRequest),
            state: row.pullRequestState,
            openedAt: row.pullRequestOpenedAt,
            closedAt: row.pullRequestClosedAt,
          }
        : null,
  });
};
