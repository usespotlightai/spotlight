import type { ConnectedRunnerDto } from '@application/dto/connected-runner.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import { ConnectedRunnerMapper } from '@application/mappers/connected-runner.mapper';
import type { ClockPort } from '@application/ports/clock.port';
import type { QueryHandlerPort } from '@application/ports/query-handler.port';
import type { RunnerReaderPort } from '@application/ports/runner-reader.port';
import type { ListRunnersQuery } from '@application/queries/list-runners.query';

const SILENT_FOR_TOO_LONG_MS = 45_000;

export class ListRunnersHandler
  implements QueryHandlerPort<ListRunnersQuery, ConnectedRunnerDto[]>
{
  constructor(
    private readonly runners: RunnerReaderPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(): Promise<ConnectedRunnerDto[]> {
    try {
      const now = this.clock.now().getTime();
      const found = await this.runners.listAll();

      return found.map((runner) =>
        ConnectedRunnerMapper.summaryToDto(
          runner,
          now - runner.lastSeenAt.getTime() <= SILENT_FOR_TOO_LONG_MS,
        ),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
