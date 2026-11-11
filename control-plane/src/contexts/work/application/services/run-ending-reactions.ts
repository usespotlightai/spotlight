import type { RunEndedIntegrationEvent } from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import {
  isRunFailureCode,
  type RunFailureCode,
} from '@shared-kernel/domain/value-objects/run-failure-code';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { Attachment } from '@work/domain/value-objects/attachment.vo';
import { DispatchEnding } from '@work/domain/value-objects/dispatch-ending.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { RunResult } from '@work/domain/value-objects/run-result.vo';

export interface RunEndingReactions {
  onRunEnded(event: RunEndedIntegrationEvent): Promise<void>;
}

interface ReportedFile {
  readonly id: string;
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

interface ReportedOutcome {
  readonly exitCode: number | null;
  readonly failure: string | null;
  readonly message: string | null;
  readonly stopped: boolean;
}

interface ReportedHandover {
  readonly next: string | null;
  readonly note: string | null;
  readonly files: readonly ReportedFile[];
}

export const RunsTranslation = {
  failure(code: string | null): RunFailureCode | null {
    if (code === null) {
      return null;
    }

    if (!isRunFailureCode(code)) {
      throw new InconsistentStateError(
        'run',
        `ended with a failure Work does not know: ${code}`,
      );
    }

    return code;
  },

  result(outcome: ReportedOutcome): RunResult {
    return RunResult.of({
      exitCode: outcome.exitCode ?? -1,
      failure: RunsTranslation.failure(outcome.failure),
      message: outcome.message,
      stopped: outcome.stopped,
    });
  },

  handover(handover: ReportedHandover): Handover {
    return Handover.of({
      next: handover.next ?? '',
      note: handover.note ?? '',
      attachments: handover.files.map((each) => Attachment.rehydrate(each)),
    });
  },

  session(session: string | null): HarnessSession | null {
    return session ? HarnessSession.of(session) : null;
  },
};

export const RunEndedFacts = {
  runId(event: RunEndedIntegrationEvent): RunId {
    return RunId.of(event.runId);
  },

  failure(event: RunEndedIntegrationEvent): RunFailureCode | null {
    return RunsTranslation.failure(event.failure);
  },

  result(event: RunEndedIntegrationEvent): RunResult {
    return RunsTranslation.result(event);
  },

  handover(event: RunEndedIntegrationEvent): Handover | null {
    return event.report ? RunsTranslation.handover(event.report) : null;
  },

  session(event: RunEndedIntegrationEvent): HarnessSession | null {
    return RunsTranslation.session(event.session);
  },

  claimedBy(event: RunEndedIntegrationEvent): RunnerId | null {
    return event.claimedBy ? RunnerId.of(event.claimedBy) : null;
  },

  ending(event: RunEndedIntegrationEvent): DispatchEnding {
    return DispatchEnding.of({
      endedAt: new Date(event.endedAt),
      outcome: event.outcome,
      failure: RunsTranslation.failure(event.failure),
      stopped: event.stopped,
      askedAPerson: event.askedAPerson,
    });
  },
};
