import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { RunConfigDto } from '@work/application/dto/run-config.dto';
import type {
  ConfiguredRun,
  RunReaderPort,
} from '@work/application/ports/run-reader.port';
import type { ReadRunConfigQuery } from '@work/application/queries/read-run-config.query';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';

const configOf = (run: ConfiguredRun): StationConfig =>
  StationConfig.rehydrate(run.parts, run.fingerprint);

export class ReadRunConfigHandler
  implements QueryHandlerPort<ReadRunConfigQuery, RunConfigDto | null>
{
  constructor(private readonly runs: RunReaderPort) {}

  async execute(query: ReadRunConfigQuery): Promise<RunConfigDto | null> {
    try {
      const found = await this.runs.configFor(
        RunId.of(query.runId),
        UserId.of(query.viewerId),
      );

      if (!found) {
        return null;
      }

      if (!found.ran) {
        return { fingerprint: null, config: null, changedSince: null };
      }

      const ran = configOf(found.ran);
      const before = found.before ? configOf(found.before) : null;

      return {
        fingerprint: ran.fingerprint,
        config: ran.parts,
        changedSince:
          found.before && before && !before.sameAs(ran)
            ? {
                runId: found.before.runId,
                taskId: found.before.taskId,
                fingerprint: before.fingerprint,
                changes: ran.changesFrom(before),
              }
            : null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
