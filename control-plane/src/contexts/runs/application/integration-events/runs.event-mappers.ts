import { runOutcomeText } from '@runs/application/rendering/run-outcome.text';
import type { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import type { RunEnded } from '@runs/domain/events/run-ended.event';
import type { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import type { RunSuspended } from '@runs/domain/events/run-suspended.event';
import type { RunUsageRecorded } from '@runs/domain/events/run-usage-recorded.event';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
  type RunEndingPublished,
  type RunOutcomePublished,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import {
  RUN_SUSPENDED,
  type RunSuspendedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-suspended.integration-event';
import {
  RUN_USAGE_RECORDED,
  type RunUsageRecordedIntegrationEvent,
} from '@shared-kernel/application/integration-events/run-usage-recorded.integration-event';
import { mapping } from '@shared-kernel/application/ports/integration-event-mapper.port';

interface Ending {
  readonly ending: RunEndingPublished;
  readonly outcome: RunOutcomePublished;
  readonly failure: string | null;
  readonly exitCode: number | null;
  readonly message: string | null;
  readonly stopped: boolean;
  readonly handsOver: boolean;
  readonly reported: boolean;
  readonly report: RunEndedIntegrationEvent['report'];
  readonly session: string | null;
  readonly claimedBy: string | null;
  readonly expiredLeases: number;
}

const NOT_REPORTED = {
  exitCode: null,
  message: null,
  stopped: false,
  handsOver: false,
  reported: false,
  report: null,
  session: null,
  claimedBy: null,
  expiredLeases: 0,
} as const;

const requestedRunEnded = (
  event: RunEnded | RunExhausted | RunCancelled,
  ending: Ending,
): RunEndedIntegrationEvent => ({
  kind: RUN_ENDED,
  runId: event.runId.value,
  workspaceId: event.workspaceId.value,
  requester: event.requester.parts,
  attempt: event.attempt.number,
  ending: ending.ending,
  outcome: ending.outcome,
  failure: ending.failure,
  exitCode: ending.exitCode,
  message: ending.message,
  stopped: ending.stopped,
  started: event.started,
  askedAPerson: event.asked,
  handsOver: ending.handsOver,
  reported: ending.reported,
  report: ending.report,
  session: ending.session,
  claimedBy: ending.claimedBy,
  expiredLeases: ending.expiredLeases,
  endedAt: event.endedAt.toISOString(),
});

export const RUNS_EVENT_MAPPERS = [
  mapping<RunEnded>('run.ended', (event) =>
    requestedRunEnded(event, {
      ending: 'completed',
      outcome: event.outcome.failed ? 'failed' : 'completed',
      failure: event.outcome.failure?.code ?? null,
      exitCode: event.outcome.exitCode.value,
      message: runOutcomeText(event.outcome),
      stopped: event.outcome.stopped,
      handsOver: event.outcome.handsOver,
      reported: event.reported,
      report: event.handover
        ? {
            next: event.handover.next || null,
            note: event.handover.note || null,
            files: event.handover.attachments.map((each) => ({
              id: each.id,
              name: each.name,
              contentType: each.contentType,
              size: each.size,
            })),
          }
        : null,
      session: event.session?.value ?? null,
      claimedBy: event.claimedBy?.value ?? null,
      expiredLeases: 0,
    }),
  ),
  mapping<RunExhausted>('run.exhausted', (event) =>
    requestedRunEnded(event, {
      ...NOT_REPORTED,
      ending: 'exhausted',
      outcome: 'exhausted',
      failure: event.failure,
      expiredLeases: event.expiredLeases,
    }),
  ),
  mapping<RunCancelled>('run.cancelled', (event) =>
    requestedRunEnded(event, {
      ...NOT_REPORTED,
      ending: 'cancelled',
      outcome: 'cancelled',
      failure: null,
    }),
  ),
  mapping<RunSuspended>(
    'run.suspended',
    (event): RunSuspendedIntegrationEvent => ({
      kind: RUN_SUSPENDED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      requester: event.requester.parts,
      attempt: event.attempt.number,
      at: event.at.toISOString(),
    }),
  ),
  mapping<RunUsageRecorded>(
    'run.usage-recorded',
    (event): RunUsageRecordedIntegrationEvent => ({
      kind: RUN_USAGE_RECORDED,
      runId: event.runId.value,
      workspaceId: event.workspaceId.value,
      requester: {
        owner: event.requester.owner.value,
        kind: event.requester.kind,
        id: event.requester.id,
        token: event.requester.token,
        team: event.requester.team?.value ?? null,
      },
      listed: event.listed,
      ms: event.ms,
      steps: event.steps,
      errors: event.errors,
      changedLines: event.changedLines,
      contextTokens: event.contextTokens,
      contextWindow: event.contextWindow,
      cost: event.cost?.amount ?? null,
      currency: event.cost?.currency ?? null,
      spentCosts: event.spentCosts.map((each) => ({
        amount: each.amount,
        currency: each.currency,
      })),
      unpricedCalls: event.unpricedCalls,
      inputTokens: event.tokens.input,
      outputTokens: event.tokens.output,
      cacheReadTokens: event.tokens.cacheRead,
      cacheWriteTokens: event.tokens.cacheWrite,
      servers: event.tools.servers.map((each) => ({
        server: each.server,
        calls: each.calls,
        failed: each.failed,
        latency: [...each.latency.counts],
        lastCallFailed: each.lastCallFailed,
      })),
      skillsRead: [...event.tools.skills],
    }),
  ),
];
