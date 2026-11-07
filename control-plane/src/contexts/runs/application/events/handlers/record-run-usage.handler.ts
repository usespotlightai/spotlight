import type { HarnessLaunchPort } from '@runs/application/ports/harness-launch.port';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { RunUsageWriterPort } from '@runs/application/ports/run-usage-writer.port';
import { RecordedRunUsage } from '@runs/domain/entities/recorded-run-usage.entity';
import type { RunCompleted } from '@runs/domain/events/run-completed.event';
import type { RunExhausted } from '@runs/domain/events/run-exhausted.event';
import { RunRequester } from '@runs/domain/value-objects/run-requester.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RecordRunUsage {
  constructor(
    private readonly facts: RunFactsPort,
    private readonly usages: RunUsageWriterPort,
    private readonly launch: HarnessLaunchPort,
  ) {}

  onRunCompleted(event: RunCompleted): Promise<void> {
    return this.record(event.runId);
  }

  onRunExhausted(event: RunExhausted): Promise<void> {
    return this.record(event.runId);
  }

  private async record(runId: RunId): Promise<void> {
    const [facts] = await this.facts.of([runId]);
    const read = facts?.ended ? await this.usages.readingsOf(runId) : null;

    if (!facts || !read) {
      return;
    }

    await this.usages.record(
      RecordedRunUsage.of({
        run: {
          id: facts.runId,
          workspaceId: facts.workspaceId,
          requester: RunRequester.of({ ...facts.requester, team: facts.team }),
          listed: facts.policy.listed,
          attempt: read.attempt,
        },
        readings: read.readings,
        skillHomes: this.launch.skillHomes(),
      }),
    );
  }
}
