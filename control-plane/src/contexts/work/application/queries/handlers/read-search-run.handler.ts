import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { SearchRunDto } from '@work/application/dto/search-run.dto';
import { RunJournalMapper } from '@work/application/mappers/run-journal.mapper';
import { RunSpendMapper } from '@work/application/mappers/run-spend.mapper';
import { TaskRunMapper } from '@work/application/mappers/task-run.mapper';
import type { RunDigestReaderPort } from '@work/application/ports/run-digest-reader.port';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import type { RunReaderPort } from '@work/application/ports/run-reader.port';
import type { RunSpendReaderPort } from '@work/application/ports/run-spend-reader.port';
import type { SearchAgentsPort } from '@work/application/ports/search-agents.port';
import type { ReadSearchRunQuery } from '@work/application/queries/read-search-run.query';
import { agentSpendOf } from '@work/domain/services/agent-spend';

export class ReadSearchRunHandler
  implements QueryHandlerPort<ReadSearchRunQuery, SearchRunDto | null>
{
  constructor(
    private readonly access: WorkspaceAccessPort,
    private readonly runs: RunReaderPort,
    private readonly journals: RunJournalReaderPort,
    private readonly digests: RunDigestReaderPort,
    private readonly spends: RunSpendReaderPort,
    private readonly agents: SearchAgentsPort,
  ) {}

  async execute(query: ReadSearchRunQuery): Promise<SearchRunDto | null> {
    try {
      const runId = RunId.of(query.runId);
      const reader = await this.access.permissionsAsTeamReader(
        query.teamId,
        query.principal,
      );
      const found = reader
        ? await this.runs.searchRunFor(reader.teamId, reader.workspaceId, runId)
        : null;

      if (!found) {
        return null;
      }

      const journals = await this.journals.attemptsOfRun(runId);
      const digest = (await this.digests.forRuns([runId])).get(runId.value);
      const spent = agentSpendOf(await this.spends.spendOf(runId));

      return {
        ...TaskRunMapper.summaryToDto(found),
        searchId: found.searchId,
        iteration: found.iteration,
        agent: await this.agents.agentOf(found.searchId),
        failure: found.failure,
        endedAt: found.endedAt?.toISOString() ?? null,
        spent: {
          spentCosts: spent.spentCosts.map((each) => ({
            amount: each.amount,
            currency: each.currency,
          })),
          unpricedCalls: spent.unpricedCalls,
        },
        spend: digest ? RunSpendMapper.toDto(digest) : null,
        journals: journals.map(RunJournalMapper.toDto),
        briefing: found.briefing,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
