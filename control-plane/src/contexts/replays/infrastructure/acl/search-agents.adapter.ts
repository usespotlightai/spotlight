import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { RunAgentDto } from '@work/application/dto/run-agent.dto';
import type { SearchAgentsPort } from '@work/application/ports/search-agents.port';

export class SearchAgents implements SearchAgentsPort {
  constructor(private readonly searches: SearchRepository) {}

  async agentOf(searchId: string): Promise<RunAgentDto | null> {
    const search = await this.searches.find(SearchId.of(searchId));

    return search
      ? {
          harness: search.agent.harness,
          model: search.agent.model,
          effort: search.agent.effort,
        }
      : null;
  }
}
