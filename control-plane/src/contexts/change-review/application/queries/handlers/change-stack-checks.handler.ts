import type { ChangeStackChecksDto } from '@change-review/application/dto/change-stack-check.dto';
import { diffFrom } from '@change-review/application/mappers/change-stack.from-dto';
import type { ChangeStackReaderPort } from '@change-review/application/ports/change-stack-reader.port';
import type { PatchWriterPort } from '@change-review/application/ports/patch-writer.port';
import type { WorkPort } from '@change-review/application/ports/work.port';
import type { ChangeStackChecksQuery } from '@change-review/application/queries/change-stack-checks.query';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

export class ChangeStackChecksHandler
  implements
    QueryHandlerPort<ChangeStackChecksQuery, ChangeStackChecksDto | null>
{
  constructor(
    private readonly work: WorkPort,
    private readonly stacks: ChangeStackReaderPort,
    private readonly clock: ClockPort,
    private readonly patches: PatchWriterPort,
  ) {}

  async execute(
    query: ChangeStackChecksQuery,
  ): Promise<ChangeStackChecksDto | null> {
    try {
      const runId = RunId.of(query.runId);

      if (!(await this.work.wasWorkedBy(runId, RunnerId.of(query.runnerId)))) {
        return null;
      }

      const { waiting, checks } = await this.stacks.checksOfRun(
        runId,
        this.clock.now(),
      );

      return {
        waiting,
        checks: checks.map((check) => {
          const diff = diffFrom(check.files);

          return {
            stackId: check.stackId,
            repository: check.repository,
            command: check.command,
            steps: check.steps.map((step) => ({
              id: step.id,
              patch: this.patches.patchOf(diff, new Set(step.hunks)),
            })),
          };
        }),
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
