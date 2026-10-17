import type { ChangeJudged } from '@outcomes/domain/events/change-judged.event';
import type { ChangeJudgingFailed } from '@outcomes/domain/events/change-judging-failed.event';
import type { PairJudged } from '@outcomes/domain/events/pair-judged.event';
import type { PairJudgingFailed } from '@outcomes/domain/events/pair-judging-failed.event';
import {
  CHANGE_JUDGED,
  type ChangeJudgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judged.integration-event';
import {
  CHANGE_JUDGING_FAILED,
  type ChangeJudgingFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judging-failed.integration-event';
import {
  PAIR_JUDGED,
  type PairJudgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pair-judged.integration-event';
import {
  PAIR_JUDGING_FAILED,
  type PairJudgingFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/pair-judging-failed.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const OUTCOMES_EVENT_MAPPERS = [
  mapping<ChangeJudged>(
    'change-judging.judged',
    (event): ChangeJudgedIntegrationEvent => ({
      kind: CHANGE_JUDGED,
      runId: event.runId.value,
      round: event.round,
      workspaceId: event.workspaceId.value,
      scale: event.scale.kind,
      value: event.value,
      marks: event.marks && [...event.marks],
      claims: [...event.claims],
      passShare: event.passShare,
      model: event.model,
      reasons: event.reasons.map((reason) => ({
        text: reason.text,
        steps: reason.citations.flatMap((each) =>
          each.step === null ? [] : [each.step],
        ),
        hunks: reason.citations.flatMap((each) =>
          each.hunk === null ? [] : [each.hunk],
        ),
        claim: reason.claim,
      })),
      referenced: event.referenced,
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
      at: event.at.toISOString(),
    }),
  ),
  mapping<ChangeJudgingFailed>(
    'change-judging.failed',
    (event): ChangeJudgingFailedIntegrationEvent => ({
      kind: CHANGE_JUDGING_FAILED,
      runId: event.runId.value,
      round: event.round,
      workspaceId: event.workspaceId.value,
      failure: event.failure.code,
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
    }),
  ),
  mapping<PairJudged>(
    'pair-judging.judged',
    (event): PairJudgedIntegrationEvent => ({
      kind: PAIR_JUDGED,
      runId: event.runId.value,
      againstRunId: event.against.value,
      workspaceId: event.workspaceId.value,
      winner: event.winner,
      model: event.model,
      readings: event.readings.map((reading) => ({
        runShownFirst: reading.runShownFirst,
        winner: reading.winner,
        reasons: reading.reasons.map((each) => ({
          text: each.text,
          runHunks: [...each.runHunks],
          againstHunks: [...each.againstHunks],
        })),
      })),
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
      at: event.at.toISOString(),
    }),
  ),
  mapping<PairJudgingFailed>(
    'pair-judging.failed',
    (event): PairJudgingFailedIntegrationEvent => ({
      kind: PAIR_JUDGING_FAILED,
      runId: event.runId.value,
      againstRunId: event.against.value,
      workspaceId: event.workspaceId.value,
      failure: event.failure.code,
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
    }),
  ),
] as const;
