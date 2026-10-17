import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { ReplayRunDto } from '@work/application/dto/replay-run.dto';
import { RunJournalMapper } from '@work/application/mappers/run-journal.mapper';
import { RunSpendMapper } from '@work/application/mappers/run-spend.mapper';
import { TaskRunMapper } from '@work/application/mappers/task-run.mapper';
import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { ReadReplayRunQuery } from '@work/application/queries/read-replay-run.query';

export class ReadReplayRunHandler
  implements QueryHandlerPort<ReadReplayRunQuery, ReplayRunDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runs: RunReaderPort,
    private readonly journals: RunJournalReaderPort,
    private readonly digests: RunDigestReaderPort,
  ) {}

  async execute(query: ReadReplayRunQuery): Promise<ReplayRunDto | null> {
    try {
      const runId = RunId.of(query.runId);
      const reader = await this.access.permissionsAsTeamReader(
        query.teamId,
        query.principal,
      );
      const found = reader
        ? await this.runs.replayFor(reader.teamId, reader.workspaceId, runId)
        : null;

      if (!found) {
        return null;
      }

      const [journals, digests] = await Promise.all([
        this.journals.attemptsOfRun(runId),
        this.digests.forRuns([runId]),
      ]);
      const digest = digests.get(runId.value);

      return {
        ...TaskRunMapper.summaryToDto(found),
        original: { ...found.original },
        spend: digest ? RunSpendMapper.toDto(digest) : null,
        journals: journals.map(RunJournalMapper.toDto),
        briefing: found.briefing,
        agent: found.agent,
        repositories: found.repositories,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
