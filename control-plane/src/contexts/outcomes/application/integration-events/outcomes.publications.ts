import type { ChangeJudged } from '@outcomes/domain/events/change-judged.event';
import type { ChangeJudgingFailed } from '@outcomes/domain/events/change-judging-failed.event';
import {
  CHANGE_JUDGED,
  type ChangeJudgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judged.integration-event';
import {
  CHANGE_JUDGING_FAILED,
  type ChangeJudgingFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judging-failed.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

export const OUTCOMES_PUBLICATIONS = [
  publishing<ChangeJudged>(
    'change-judging.judged',
    (event): ChangeJudgedIntegrationEvent => ({
      kind: CHANGE_JUDGED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      scale: event.scale.kind,
      value: event.value,
      model: event.model,
      reasons: event.reasons.map((reason) => ({
        text: reason.text,
        steps: reason.citations.flatMap((each) =>
          each.step === null ? [] : [each.step],
        ),
        hunks: reason.citations.flatMap((each) =>
          each.hunk === null ? [] : [each.hunk],
        ),
      })),
      referenced: event.referenced,
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
      at: event.at.toISOString(),
    }),
  ),
  publishing<ChangeJudgingFailed>(
    'change-judging.failed',
    (event): ChangeJudgingFailedIntegrationEvent => ({
      kind: CHANGE_JUDGING_FAILED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      failure: event.failure.code,
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
    }),
  ),
] as const;
