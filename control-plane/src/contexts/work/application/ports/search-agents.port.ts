import type { RunAgentDto } from '@work/application/dto/run-agent.dto';

export const SEARCH_AGENTS = Symbol('SEARCH_AGENTS');

export interface SearchAgentsPort {
  agentOf(searchId: string): Promise<RunAgentDto | null>;
}
