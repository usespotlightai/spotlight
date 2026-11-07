import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { RunFactsPort } from '@work/application/ports/run-facts.port';
import type { RunUsageWriterPort } from '@work/application/ports/run-usage-writer.port';
import { RecordedRunUsage } from '@work/domain/entities/recorded-run-usage.entity';
import type { RunCompleted } from '@work/domain/events/run-completed.event';
import type { RunExhausted } from '@work/domain/events/run-exhausted.event';
import { RunRequester } from '@work/domain/value-objects/run-requester.vo';

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
