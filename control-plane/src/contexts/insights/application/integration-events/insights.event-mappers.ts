import type { ChangeJudged } from '@insights/domain/events/change-judged.event';
import type { ChangeJudgingFailed } from '@insights/domain/events/change-judging-failed.event';
import type { SideBySideJudged } from '@insights/domain/events/side-by-side-judged.event';
import type { SideBySideJudgingFailed } from '@insights/domain/events/side-by-side-judging-failed.event';
import type { StationAlertFired } from '@insights/domain/events/station-alert-fired.event';
import {
  CHANGE_JUDGED,
  type ChangeJudgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judged.integration-event';
import {
  CHANGE_JUDGING_FAILED,
  type ChangeJudgingFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/change-judging-failed.integration-event';
import {
  SIDE_BY_SIDE_JUDGED,
  type SideBySideJudgedIntegrationEvent,
} from '@shared-kernel/application/integration-events/side-by-side-judged.integration-event';
import {
  SIDE_BY_SIDE_JUDGING_FAILED,
  type SideBySideJudgingFailedIntegrationEvent,
} from '@shared-kernel/application/integration-events/side-by-side-judging-failed.integration-event';
import {
  STATION_ALERT_FIRED,
  type StationAlertFiredIntegrationEvent,
} from '@shared-kernel/application/integration-events/station-alert-fired.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

export const INSIGHTS_EVENT_MAPPERS = [
  mapping<ChangeJudged>(
    'change-judging.judged',
    (event): ChangeJudgedIntegrationEvent => ({
      kind: CHANGE_JUDGED,
      runId: event.runId.value,
      attempt: event.attempt,
      workspaceId: event.workspaceId.value,
      scale: event.scale.kind,
      value: event.value,
      claimResults: event.claimResults && [...event.claimResults],
      claims: [...event.claims],
      passThreshold: event.passThreshold,
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
      guidance: event.guidance,
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
      attempt: event.attempt,
      workspaceId: event.workspaceId.value,
      failure: event.failure.code,
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
    }),
  ),
  mapping<SideBySideJudged>(
    'side-by-side-judging.judged',
    (event): SideBySideJudgedIntegrationEvent => ({
      kind: SIDE_BY_SIDE_JUDGED,
      runId: event.runId.value,
      otherRunId: event.otherRunId.value,
      workspaceId: event.workspaceId.value,
      winner: event.winner,
      model: event.model,
      passes: event.passes.map((pass) => ({
        runShownFirst: pass.runShownFirst,
        winner: pass.winner,
        reasons: pass.reasons.map((each) => ({
          text: each.text,
          runHunks: [...each.runHunks],
          otherHunks: [...each.otherHunks],
        })),
      })),
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
      at: event.at.toISOString(),
    }),
  ),
  mapping<SideBySideJudgingFailed>(
    'side-by-side-judging.failed',
    (event): SideBySideJudgingFailedIntegrationEvent => ({
      kind: SIDE_BY_SIDE_JUDGING_FAILED,
      runId: event.runId.value,
      otherRunId: event.otherRunId.value,
      workspaceId: event.workspaceId.value,
      failure: event.failure.code,
      spentCosts: event.spent.costs.map((each) => ({ ...each })),
      unpricedCalls: event.spent.unpriced,
    }),
  ),
  mapping<StationAlertFired>(
    'station-alert.fired',
    (event): StationAlertFiredIntegrationEvent => ({
      kind: STATION_ALERT_FIRED,
      alertId: event.alertId.value,
      workspaceId: event.workspaceId.value,
      teamId: event.teamId.value,
      stationId: event.stationId,
    }),
  ),
] as const;
