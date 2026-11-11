import { RunUsageRecorded } from '@runs/domain/events/run-usage-recorded.event';
import type { RunAttempt } from '@runs/domain/value-objects/run-attempt.vo';
import type { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import {
  type AttemptReading,
  RunUsage,
} from '@runs/domain/value-objects/run-usage.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface UsingRun {
  readonly id: RunId;
  readonly workspaceId: WorkspaceId;
  readonly requester: RunRequester;
  readonly listed: boolean;
  readonly attempt: RunAttempt;
}

export class RecordedRunUsage {
  private constructor(
    readonly run: UsingRun,
    readonly usage: RunUsage,
  ) {}

  static of(input: {
    run: UsingRun;
    readings: readonly AttemptReading[];
    skillHomes: readonly string[];
  }): RecordedRunUsage {
    return new RecordedRunUsage(
      input.run,
      RunUsage.across(input.readings, input.skillHomes),
    );
  }

  recordedFirst(inserted: boolean): RunUsageRecorded | null {
    const { run, usage } = this;

    return inserted
      ? new RunUsageRecorded(
          run.id,
          run.workspaceId,
          run.requester,
          run.listed,
          run.attempt,
          usage.ms,
          usage.steps,
          usage.errors,
          usage.changedLines,
          usage.contextTokens,
          usage.contextWindow,
          usage.cost,
          usage.spentCosts,
          usage.unpricedCalls,
          usage.tokens,
          usage.tools,
        )
      : null;
  }
}
