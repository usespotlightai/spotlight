import type { RequestedRunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/requested-run-ended.integration-event';
import { isRunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RunResult } from '@work/domain/value-objects/run-result.vo';

export type RunEnded = RequestedRunEndedIntegrationEvent;

export interface RunEndingReactions {
  onRunEnded(event: RunEnded): Promise<void>;
}

export const RunEndedFacts = {
  runId(event: RunEnded): RunId {
    return RunId.of(event.runId);
  },

  result(event: RunEnded): RunResult {
    return RunResult.of({
      exitCode: event.exitCode ?? -1,
      failure:
        event.failure !== null && isRunFailureCode(event.failure)
          ? event.failure
          : null,
      message: event.message,
      stopped: event.stopped,
    });
  },

  handover(event: RunEnded): Handover | null {
    return event.report
      ? Handover.of({
          next: event.report.next ?? '',
          note: event.report.note ?? '',
          attachments: event.report.files.map((each) =>
            Attachment.rehydrate(each),
          ),
        })
      : null;
  },

  session(event: RunEnded): HarnessSession | null {
    return event.session ? HarnessSession.of(event.session) : null;
  },

  claimedBy(event: RunEnded): RunnerId | null {
    return event.claimedBy ? RunnerId.of(event.claimedBy) : null;
  },
};
